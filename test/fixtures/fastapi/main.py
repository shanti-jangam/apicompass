from fastapi import FastAPI, APIRouter

app = FastAPI()
router = APIRouter()


@app.get("/users")
async def get_users():
    return []


@app.post("/users")
async def create_user():
    return {"id": 1}


@app.get("/users/{user_id}")
async def get_user(user_id: int):
    return {"id": user_id}


@app.get(
    "/statistics",
)
async def get_statistics():
    return {}


@router.get("/items")
async def list_items():
    return []


@router.post("/items")
async def create_item():
    return {"id": 1}

