from fastapi import APIRouter, Body
from core.database import db

router = APIRouter(prefix="/thread", tags=["thread"])


@router.get("/all")
async def get_all_threads():
    threads = db.threads.find({}, {"_id": 0})
    return {"threads": list(threads)}


@router.post("/delete")
async def delete_thread(body: dict = Body(...)):
    thread_id = body.get("thread_id")
    if not thread_id:
        return {"error": "Thread ID is required"}

    result = db.threads.delete_one({"thread_id": thread_id})
    if result.deleted_count == 1:
        return {"message": f"Thread {thread_id} deleted successfully"}
    return {"error": "Thread not found"}


@router.get("/{thread_id}")
async def get_thread(thread_id: str):
    thread = db.threads.find_one({"thread_id": thread_id}, {"_id": 0})  # exclude _id
    if thread:
        return thread
    return {"error": "Thread not found"}
