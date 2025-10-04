import random, os, json
import numpy as np
import torch, yaml
from pathlib import Path
from datetime import datetime

def seed_everything(seed=1337):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

def load_yaml(path):
    with open(path, "r") as f: 
        return yaml.safe_load(f)

def ensure_dir(p):
    p = Path(p); p.mkdir(parents=True, exist_ok=True); return p

def timestamped_dir(root):
    root = ensure_dir(root)
    run = datetime.now().strftime("run_%Y%m%d_%H%M%S")
    out = root / run
    out.mkdir(exist_ok=True)
    return out

def device_auto():
    if torch.backends.mps.is_available():
        print("⚡ Using Apple Silicon GPU (MPS)")
        return torch.device("mps")
    elif torch.cuda.is_available():
        print("⚡ Using CUDA GPU")
        return torch.device("cuda")
    else:
        print("⚠️ Falling back to CPU")
        return torch.device("cpu")

def save_json(obj, path):
    with open(path, "w") as f: 
        json.dump(obj, f, indent=2)
