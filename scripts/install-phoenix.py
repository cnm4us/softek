"""Install only Softek's pinned, private Phoenix service; invoke as workspace owner.

Requires ignored artifacts/phoenix-bootstrap/bin/uv and the pinned managed Python
under artifacts/python; bootstrap commands are documented in LOCAL_SETUP.md.
"""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent.parent
source = root / "artifacts/python/cpython-3.12.12-linux-x86_64-gnu"
uv = root / "artifacts/phoenix-bootstrap/bin/uv"
if not source.is_dir() or not uv.is_file():
    raise RuntimeError("Prepare the documented isolated Python/uv bootstrap first")
helper = r'''
import json,os,pwd,shutil,subprocess,sys
p=json.load(sys.stdin)
os.environ['UV_CACHE_DIR']=p['root']+'/artifacts/uv-cache'
try: user=pwd.getpwnam('softek-phoenix')
except KeyError:
 subprocess.run(['useradd','--system','--user-group','--home-dir','/var/lib/softek-phoenix','--shell','/usr/sbin/nologin','softek-phoenix'],check=True)
 user=pwd.getpwnam('softek-phoenix')
base='/opt/softek-phoenix'
os.makedirs(base,exist_ok=True)
if not os.path.exists(base+'/python'):shutil.copytree(p['python'],base+'/python',symlinks=True)
if not os.path.exists(base+'/venv'):subprocess.run([p['uv'],'venv','--python',base+'/python/bin/python3.12',base+'/venv'],check=True)
subprocess.run([p['uv'],'pip','install','--quiet','--python',base+'/venv/bin/python','-r',p['root']+'/deploy/phoenix-requirements.lock'],check=True)
shutil.copy2(p['root']+'/deploy/phoenix-http.py',base+'/phoenix-http.py')
os.makedirs('/var/lib/softek-phoenix',exist_ok=True)
os.chown('/var/lib/softek-phoenix',user.pw_uid,user.pw_gid);os.chmod('/var/lib/softek-phoenix',0o700)
shutil.copy2(p['root']+'/deploy/systemd.softek-phoenix.service','/etc/systemd/system/softek-phoenix.service')
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','softek-phoenix.service'],check=True)
'''
subprocess.run(
    ["sudo", "-n", "python3", "-c", helper],
    input=json.dumps({"root": str(root), "python": str(source), "uv": str(uv)}),
    text=True,
    check=True,
    env={**__import__("os").environ, "UV_CACHE_DIR": str(root / "artifacts/uv-cache")},
)
