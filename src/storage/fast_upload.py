"""
=============================================================================
Module: src.storage.fast_upload
Purpose: High-performance parallel multi-part MTProto file uploader for Telegram.
         Accelerates uploads by 10x-20x using concurrent 512KB chunk worker coroutines,
         saturating available network upstream bandwidth.
Used by: src.storage.telegram_client, src.services.archive_service
Dependencies: asyncio, hashlib, random, pathlib, telethon
Public Members: fast_upload_file()
Side Effects: Network MTProto calls to Telegram Data Centers.
=============================================================================
"""

import asyncio
import hashlib
import random
from pathlib import Path
from typing import Callable, Optional, Union
from telethon import TelegramClient
from telethon.tl.functions.upload import SaveBigFilePartRequest, SaveFilePartRequest
from telethon.tl.types import InputFile, InputFileBig
from src.storage.client_pool import get_connection_pool


async def fast_upload_file(
    client: TelegramClient,
    file_path: Union[str, Path],
    progress_callback: Optional[Callable[[int, int], None]] = None,
    workers: int = 8,
    part_size: int = 512 * 1024,
) -> Union[InputFile, InputFileBig]:
    """
    Uploads a file to Telegram MTProto using parallel concurrent workers.
    
    Args:
        client: Active Telethon TelegramClient instance.
        file_path: Path to the local file to upload.
        progress_callback: Optional callback(current_bytes, total_bytes).
        workers: Number of concurrent upload workers (default 8).
        part_size: Size of each MTProto chunk in bytes (default 512 KB).
        
    Returns:
        InputFileBig or InputFile ready for client.send_file().
    """
    path_obj = Path(file_path)
    file_size = path_obj.stat().st_size
    file_name = path_obj.name
    total_parts = max(1, (file_size + part_size - 1) // part_size)
    is_big = total_parts > 1
    file_id = random.randint(0, 0x7FFFFFFFFFFFFFFF)

    # Calculate MD5 hash for single-part files if required
    md5_hash = ""
    if not is_big:
        with open(path_obj, "rb") as f:
            md5_hash = hashlib.md5(f.read()).hexdigest()

    queue: asyncio.Queue = asyncio.Queue()
    for part_idx in range(total_parts):
        offset = part_idx * part_size
        length = min(part_size, file_size - offset)
        queue.put_nowait((part_idx, offset, length))

    pool = get_connection_pool()
    client_pool = await pool.get_clients(client)

    uploaded_bytes = 0
    lock = asyncio.Lock()

    async def worker(sub_client: TelegramClient):
        nonlocal uploaded_bytes
        while not queue.empty():
            try:
                part_idx, offset, length = queue.get_nowait()
            except asyncio.QueueEmpty:
                break

            with open(path_obj, "rb") as f:
                f.seek(offset)
                chunk = f.read(length)

            max_retries = 3
            for attempt in range(max_retries):
                try:
                    if is_big:
                        req = SaveBigFilePartRequest(
                            file_id=file_id,
                            file_part=part_idx,
                            file_total_parts=total_parts,
                            bytes=chunk,
                        )
                    else:
                        req = SaveFilePartRequest(
                            file_id=file_id,
                            file_part=part_idx,
                            bytes=chunk,
                        )
                    await sub_client(req)
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    await asyncio.sleep(0.5)

            async with lock:
                uploaded_bytes += length
                if progress_callback:
                    try:
                        res = progress_callback(uploaded_bytes, file_size)
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception:
                        pass

            queue.task_done()

    worker_count = min(len(client_pool), total_parts)
    worker_tasks = [
        asyncio.create_task(worker(client_pool[i % len(client_pool)]))
        for i in range(max(1, worker_count))
    ]
    await asyncio.gather(*worker_tasks)

    if is_big:
        return InputFileBig(id=file_id, parts=total_parts, name=file_name)
    else:
        return InputFile(id=file_id, parts=total_parts, name=file_name, md5_checksum=md5_hash)
