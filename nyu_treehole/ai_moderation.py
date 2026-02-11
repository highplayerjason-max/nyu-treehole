
import json
import time
import requests
import threading
import queue
from typing import Tuple, Optional

from .config import (
    AI_MODERATION_API_KEY,
    AI_MODERATION_BASE_URL,
    AI_MODERATION_MODEL,
)

class ModerationRequest:
    def __init__(self, text: str):
        self.text = text
        self.result: Optional[Tuple[bool, str]] = None
        self.event = threading.Event()

class ModerationWorker(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.queue = queue.Queue()
        self.running = True

    def submit(self, text: str) -> Tuple[bool, str]:
        req = ModerationRequest(text)
        self.queue.put(req)
        req.event.wait()  # Block until processed
        return req.result

    def run(self):
        url = f"{AI_MODERATION_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {AI_MODERATION_API_KEY}",
            "Content-Type": "application/json",
        }

        while self.running:
            req = self.queue.get()
            if req is None:
                break
            
            try:
                self._process_request(req, url, headers)
            except Exception as e:
                print(f"Worker Error: {e}")
                req.result = (False, f"Worker Error: {e}")
            finally:
                req.event.set()
                self.queue.task_done()

    def _process_request(self, req: ModerationRequest, url: str, headers: dict):
        prompt = f"""
        You are a moderator of a school forum, you only avoid those are 18+(sex contents), or illegal(like drug, gambling), or politic related, or discrimmination(sex or racial). Analyze this post,: '{req.text}'
        
        Return JSON with this schema:
        {{
            "is_safe": boolean,
            "category": "safe" | "political" | "illegal" | "discrimmination",
            "reason": "short explanation"
        }}
        """
        
        payload = {
            "model": AI_MODERATION_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        }

        max_retries = 3
        backoff = 2
        
        for attempt in range(max_retries + 1):
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=60)
                
                if response.status_code == 200:
                    result = response.json()
                    content_str = result['choices'][0]['message']['content']
                    try:
                        content_json = json.loads(content_str)
                        is_safe = content_json.get("is_safe", False)
                        reason = content_json.get("reason", "No reason provided")
                        req.result = (is_safe, reason)
                        return
                    except json.JSONDecodeError:
                        req.result = (False, f"Invalid JSON response from AI: {content_str}")
                        return
                
                elif response.status_code == 429:
                    print(f"AI Moderation 429 Too Many Requests. Cooling down for {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2  # Exponential backoff
                    continue # Retry
                
                else:
                    print(f"AI Moderation API Error {response.status_code}: {response.text}")
                    if attempt == max_retries:
                         req.result = (False, f"API Error: {response.status_code}")
                         return

            except Exception as e:
                print(f"AI Moderation Request Failed: {e}")
                if attempt == max_retries:
                    req.result = (False, f"Request Failed: {str(e)}")
                    return
            
            # General retry wait (non-429 errors), only wait if we are going to retry
            if attempt < max_retries:
                time.sleep(1)
        
        req.result = (False, "Moderation failed after retries")


# Start the worker thread globally
_worker = ModerationWorker()
_worker.start()

def check_content_safety(text: str) -> Tuple[bool, str]:
    """
    Checks if the content is safe using the AI moderation API via a background queue.
    This blocks the calling thread until the worker processes the request.
    """
    return _worker.submit(text)
