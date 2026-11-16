"""
Read a thread from Python with genlayer-py 0.19.0rc2.

    python web/examples/read_thread.py <thread id>

Reads need an account even for views, so a throwaway one is made and never funded.
"""
import json
import sys

from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet

CONTRACT = json.load(open("web/lib/deployment.json"))["restate"]
studio_devnet.rpc_urls = {"default": {"http": ["https://studio-next.genlayer.com/api"]}}

client = create_client(chain=studio_devnet, account=create_account())
thread = json.loads(client.read_contract(address=CONTRACT, function_name="get_thread", args=[int(sys.argv[1])]))
labels = [{"turn": t["n"], "status": t["status"], "label": t["label"], "tries_left": t["tries_left"]} for t in thread.get("turns", [])]
print(json.dumps({"found": thread["found"], "status": thread.get("status"), "phase": thread.get("phase"), "turn": thread.get("turn"), "labels": labels}))
