import aiofiles
import asyncio
import json
import os
import re
import shutil
import tempfile
import time
import traceback
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.llm import llm
from app.socket import is_client_connected, sio
from app.utils.generate_references import getReferenceWork
from app.utils.generate_worklets import generate_worklets
from app.utils.make_files import generatePdf
from app.utils.link_extractor import get_links_data
from app.utils.document_parser import extract_document

class Query1(BaseModel):
    query: str

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

UPLOAD_DIR = os.path.join(PROJECT_ROOT, "../worklets")
os.makedirs(UPLOAD_DIR, exist_ok=True)

GENERATED_DIR_PDF = os.path.join(PROJECT_ROOT, "resources/generated_worklets/pdf")
os.makedirs(GENERATED_DIR_PDF, exist_ok=True)
DESTINATION_DIR_PDF = os.path.join(PROJECT_ROOT, "./resources/archived_worklets/pdf")
os.makedirs(DESTINATION_DIR_PDF, exist_ok=True)

GENERATED_DIR_PPT = os.path.join(PROJECT_ROOT, "resources/generated_worklets/ppt")
os.makedirs(GENERATED_DIR_PPT, exist_ok=True)
DESTINATION_DIR_PPT = os.path.join(PROJECT_ROOT, "./resources/archived_worklets/ppt")
os.makedirs(DESTINATION_DIR_PPT, exist_ok=True)

os.makedirs("templates", exist_ok=True)

router = APIRouter(prefix="/generate", tags=["generate"])

templates = Jinja2Templates(directory="templates")

def sanitize_filename(filename):
    return re.sub(r'[\/:*?"<>|]', '_', filename)

# @router.get("/", response_class=HTMLResponse)
# async def read_root(request: Request):
#     return templates.TemplateResponse("index.html", {"request": request})

@router.post('/')
async def upload_multiple(
    thread_id: Annotated[str, Form()],
    links: Annotated[str, Form()],
    custom_prompt: Annotated[str, Form()],
    model: Annotated[str, Query()] = "qwen3:4b",
    files: Annotated[list[UploadFile], File()] = None,
):




@router.get('/download/{file_name}')
async def download(file_name: str):
    new_file_name = sanitize_filename(file_name) + ".pdf"
    file_path = Path(GENERATED_DIR_PDF) / new_file_name

    if not file_path.exists():
        file_path = Path(DESTINATION_DIR_PDF) / new_file_name

    safe_filename = new_file_name.replace(":", " -")
    if file_path.exists():
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=safe_filename 
        )
    return {"error": "File not found"}
class FilesRequest(BaseModel):
    files: list[str] 

@router.post("/download_all")
def download_selected(received_files: FilesRequest, type: str = Query(...)):
    """
    Handles the download of selected files by creating a zip archive containing the requested files.
    Args:
        received_files (FilesRequest): An object containing a list of file names to be downloaded.
        type (str): The type of files to download, either "pdf" or "ppt". This is passed as a query parameter.
    Returns:
        FileResponse: A response containing the zip file for download if successful.
        dict: An error message if no files are provided or if the type is invalid.
    Raises:
        None
    Notes:
        - The function searches for files in two directories based on the type:
          - For "pdf": Searches in GENERATED_DIR_PDF and DESTINATION_DIR_PDF.
          - For "ppt": Searches in GENERATED_DIR_PPT and DESTINATION_DIR_PPT.
        - Files are added to the zip archive if they exist in the specified directories.
        - If no valid files are found, an error message is returned.
        - The zip file is created as a temporary file and returned as a downloadable response.
    """

    files = received_files.files 
    if not files:
        return {"error": "No files provided."}

    # Create a temporary zip file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_zip:
        zip_path = temp_zip.name

    with zipfile.ZipFile(zip_path, 'w') as zipf:
        # Make a copy so we can modify files safely
        remaining_files = files.copy()

        if(type == "pdf"):
            # First, search and add files from GENERATED_DIR_PDF
            for file_name in files:
                search_name = file_name + ".pdf"
                file_path = os.path.join(GENERATED_DIR_PDF, search_name)
                print(file_path)
                if os.path.isfile(file_path):
                    zipf.write(file_path, arcname=search_name)
                    remaining_files.remove(file_name)

            # Then, search remaining files in DESTINATION_DIR_PDF
            for file_name in remaining_files:
                search_name = file_name + ".pdf"
                file_path = os.path.join(DESTINATION_DIR_PDF, search_name)
                if os.path.isfile(file_path):
                    zipf.write(file_path, arcname=search_name)

        elif(type == "ppt"):
            # First, search and add files from GENERATED_DIR_PPT
            for file_name in files:
                search_name = file_name + ".pptx"
                file_path = os.path.join(GENERATED_DIR_PPT, search_name)
                print(file_path)
                if os.path.isfile(file_path):
                    zipf.write(file_path, arcname=search_name)
                    remaining_files.remove(file_name)

            # Then, search remaining files in DESTINATION_DIR_PPT
            for file_name in remaining_files:
                search_name = file_name + ".pptx"
                file_path = os.path.join(DESTINATION_DIR_PPT, search_name)
                if os.path.isfile(file_path):
                    zipf.write(file_path, arcname=search_name)
        else:
            return {"error": "Invalid type. Must be 'pdf' or 'ppt'."}


    return FileResponse(zip_path, filename="worklets.zip", media_type="application/zip")


@router.post('/query')
async def create_query(query:Query1):
    message = llm.invoke(query.query)
    return message.content
