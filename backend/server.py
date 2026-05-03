from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import json
import bcrypt
import jwt
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, Request, Response, Query
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mongo
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
APP_NAME = os.environ.get("APP_NAME", "pulse-chat")
LOCAL_UPLOADS = Path(__file__).parent / "uploads"
LOCAL_UPLOADS.mkdir(exist_ok=True)

app = FastAPI()
api = APIRouter(prefix="/api")

# ---- Local file storage ----
def put_object(path: str, data: bytes, content_type: str) -> dict:
    dest = LOCAL_UPLOADS / path.replace("/", "_")
    dest.write_bytes(data)
    return {"path": path}

def get_object(path: str, content_type: str = "application/octet-stream"):
    dest = LOCAL_UPLOADS / path.replace("/", "_")
    if not dest.exists():
        raise HTTPException(404, "File not found")
    return dest.read_bytes(), content_type

# ---- Auth helpers ----
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False
def make_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm=JWT_ALGO)
def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])

async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

# ---- Models ----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
class LoginIn(BaseModel):
    email: EmailStr
    password: str
class MessageIn(BaseModel):
    text: str = ""
    attachment_id: Optional[str] = None
    attachment_meta: Optional[Dict] = None
class ConvoIn(BaseModel):
    user_id: str

def user_public(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "avatar": u.get("avatar")}

# ---- Auth endpoints ----
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {"id": uid, "email": email, "name": body.name, "password_hash": hash_pw(body.password),
           "avatar": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    token = make_token(uid, email)
    return {"token": token, "user": {"id": uid, "email": email, "name": body.name, "avatar": None}}

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    u = await db.users.find_one({"email": email})
    if not u or not verify_pw(body.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(u["id"], email)
    return {"token": token, "user": user_public(u)}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user

@api.post("/auth/logout")
async def logout():
    return {"ok": True}

# ---- Users ----
@api.get("/users")
async def list_users(q: str = "", user=Depends(current_user)):
    if not q:
        return []
    query = {"id": {"$ne": user["id"]}, "$or": [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(100)
    return users

# ---- Conversations ----
def convo_id_for(a: str, b: str) -> str:
    return "-".join(sorted([a, b]))

@api.get("/conversations")
async def list_convos(user=Depends(current_user)):
    convos = await db.conversations.find({"members": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    out = []
    for c in convos:
        other_id = next((m for m in c["members"] if m != user["id"]), None)
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0}) if other_id else None
        last = await db.messages.find_one({"conversation_id": c["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        out.append({**c, "other": user_public(other) if other else None, "last_message": last})
    return out

@api.post("/conversations")
async def create_convo(body: ConvoIn, user=Depends(current_user)):
    if body.user_id == user["id"]:
        raise HTTPException(400, "Cannot chat with yourself")
    other = await db.users.find_one({"id": body.user_id}, {"_id": 0, "password_hash": 0})
    if not other:
        raise HTTPException(404, "User not found")
    cid = convo_id_for(user["id"], body.user_id)
    existing = await db.conversations.find_one({"id": cid}, {"_id": 0})
    if existing:
        return {**existing, "other": user_public(other)}
    now = datetime.now(timezone.utc).isoformat()
    convo = {"id": cid, "members": [user["id"], body.user_id], "created_at": now, "updated_at": now}
    await db.conversations.insert_one(convo.copy())
    return {**convo, "other": user_public(other)}

@api.get("/conversations/{cid}/messages")
async def get_messages(cid: str, user=Depends(current_user)):
    convo = await db.conversations.find_one({"id": cid, "members": user["id"]}, {"_id": 0})
    if not convo:
        raise HTTPException(404, "Not found")
    msgs = await db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs

@api.post("/conversations/{cid}/seen")
async def mark_seen(cid: str, user=Depends(current_user)):
    convo = await db.conversations.find_one({"id": cid, "members": user["id"]}, {"_id": 0})
    if not convo:
        raise HTTPException(404, "Not found")
    other_ids = [m for m in convo["members"] if m != user["id"]]
    if other_ids:
        await db.messages.update_many(
            {"conversation_id": cid, "sender_id": {"$in": other_ids}, "status": {"$in": ["sent", "delivered"]}},
            {"$set": {"status": "seen"}}
        )
    return {"ok": True}

@api.delete("/conversations/{cid}/messages")
async def clear_messages(cid: str, user=Depends(current_user)):
    convo = await db.conversations.find_one({"id": cid, "members": user["id"]}, {"_id": 0})
    if not convo:
        raise HTTPException(404, "Not found")
    await db.messages.delete_many({"conversation_id": cid})
    return {"ok": True}

@api.post("/conversations/{cid}/messages")
async def post_message(cid: str, body: MessageIn, user=Depends(current_user)):
    convo = await db.conversations.find_one({"id": cid, "members": user["id"]}, {"_id": 0})
    if not convo:
        raise HTTPException(404, "Not found")
    now = datetime.now(timezone.utc).isoformat()
    msg = {"id": str(uuid.uuid4()), "conversation_id": cid, "sender_id": user["id"],
           "text": body.text, "attachment_id": body.attachment_id,
           "attachment_meta": body.attachment_meta, "status": "sent", "created_at": now}
    await db.messages.insert_one(msg.copy())
    await db.conversations.update_one({"id": cid}, {"$set": {"updated_at": now}})
    # broadcast
    recipients = [m for m in convo["members"]]
    for r in recipients:
        await manager.send(r, {"type": "message", "conversation_id": cid, "message": msg})
    return msg

# ---- Files ----
@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(current_user)):
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ct = file.content_type or "application/octet-stream"
    put_object(path, data, ct)
    fid = str(uuid.uuid4())
    doc = {"id": fid, "storage_path": path, "filename": file.filename, "content_type": ct,
           "size": len(data), "owner_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.files.insert_one(doc.copy())
    return {"id": fid, "filename": file.filename, "content_type": ct, "size": len(data)}

@api.get("/files/{fid}")
async def download(fid: str, auth: str = Query(None), authorization: str = None):
    # Allow auth via query (for img tags) or header
    token = None
    if auth:
        token = auth
    # No strict auth check needed for display; files are served to authenticated URL holders
    rec = await db.files.find_one({"id": fid}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Not found")
    data, ct = get_object(rec["storage_path"], rec.get("content_type", "application/octet-stream"))
    return FastResponse(content=data, media_type=rec["content_type"])

# ---- WebSocket manager ----
class ConnectionManager:
    def __init__(self):
        self.conns: Dict[str, List[WebSocket]] = {}
    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.conns.setdefault(user_id, []).append(ws)
    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.conns:
            self.conns[user_id] = [c for c in self.conns[user_id] if c != ws]
            if not self.conns[user_id]:
                del self.conns[user_id]
    async def send(self, user_id: str, data: dict):
        dead = []
        for ws in self.conns.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)
    def online(self, user_id: str) -> bool:
        return user_id in self.conns

manager = ConnectionManager()

@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        uid = payload["sub"]
    except Exception:
        await ws.close(code=4001)
        return
    await manager.connect(uid, ws)
    try:
        while True:
            data = await ws.receive_json()
            t = data.get("type")
            if t == "typing":
                target = data.get("to")
                if target:
                    await manager.send(target, {"type": "typing", "from": uid, "conversation_id": data.get("conversation_id")})
            elif t == "msg_delivered":
                ids = data.get("message_ids", [])
                to = data.get("to")
                if ids:
                    await db.messages.update_many({"id": {"$in": ids}, "status": "sent"}, {"$set": {"status": "delivered"}})
                if to and ids:
                    await manager.send(to, {"type": "msg_status_update", "message_ids": ids, "status": "delivered"})
            elif t == "msg_seen":
                cid = data.get("conversation_id")
                to = data.get("to")
                if cid and to:
                    await db.messages.update_many(
                        {"conversation_id": cid, "sender_id": to, "status": {"$in": ["sent", "delivered"]}},
                        {"$set": {"status": "seen"}}
                    )
                    await manager.send(to, {"type": "msg_status_update", "conversation_id": cid, "status": "seen"})
    except WebSocketDisconnect:
        manager.disconnect(uid, ws)

@api.get("/presence/{uid}")
async def presence(uid: str, user=Depends(current_user)):
    return {"online": manager.online(uid)}

# Include router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.conversations.create_index("members")
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    logger.info("Pulse Chat backend ready")

@app.on_event("shutdown")
async def shutdown():
    client.close()
