import subprocess
import time
import sys
import os

def run_tunnel():
    # Keep localtunnel alive continuously with explicit IPv4 binding
    cmd = "npx -y localtunnel --port 3000 --local-host 127.0.0.1"
    while True:
        try:
            print("[Tunnel] Starting localtunnel on port 3000...", flush=True)
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                shell=True
            )
            for line in proc.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()
            proc.wait()
        except Exception as e:
            print(f"[Tunnel Error] {e}", flush=True)
        print("[Tunnel] Disconnected. Reconnecting in 3 seconds...", flush=True)
        time.sleep(3)

if __name__ == "__main__":
    run_tunnel()
