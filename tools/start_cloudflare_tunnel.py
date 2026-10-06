import subprocess
import re
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def run_cloudflare():
    print("[Cloudflare] Starting quick tunnel for http://127.0.0.1:3000...", flush=True)
    cmd = "npx -y cloudflared tunnel --url http://127.0.0.1:3000"
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=True
    )
    for line in iter(proc.stdout.readline, ''):
        sys.stdout.write(line)
        sys.stdout.flush()
        match = re.search(r'https://[a-zA-Z0-9\-]+\.trycloudflare\.com', line)
        if match:
            url = match.group(0)
            with open("cloudflare_url.txt", "w", encoding="utf-8") as f:
                f.write(url)
            print("\n" + "="*60, flush=True)
            print(f"CLOUDFLARE LIVE URL: {url}", flush=True)
            print("="*60 + "\n", flush=True)
    proc.wait()

if __name__ == "__main__":
    run_cloudflare()
