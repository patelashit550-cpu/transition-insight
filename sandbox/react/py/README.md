# Python ReAct + Solana sandbox

Local only. Devnet by default. Never shipped.

```bash
# from repo root
sandbox/react/py/solana_env/bin/python sandbox/react/py/agent.py --dry-run
sandbox/react/py/solana_env/bin/python sandbox/react/py/agent.py "What's my balance?"
```

Rebuild the venv (no sudo): `~/.local/bin/uv venv --python 3.13.0 sandbox/react/py/solana_env && ~/.local/bin/uv pip install --python sandbox/react/py/solana_env/bin/python -r sandbox/react/py/requirements.txt`

Keys go in `.env.local` (read: SOLANA_PRIVATE_KEY, OPENAI_API_KEY, optional SOLANA_RPC_URL, HELIUS_API_KEY, HELIUS_CLUSTER, OPENAI_MODEL, ALLOW_MAINNET). Use a fresh devnet-only wallet, never the SNS signing key.

Rails: devnet default, mainnet refused unless ALLOW_MAINNET=1, `MAX_SOL_PER_TX = 0.05`, and every signing tool pauses for a yes/no.

Why not `solana_agent_kit`? Version 1.4.0 fails to import (circular import, missing `agentipy`), and its Drift/Adrena/Flash/3land/Metaplex/AllDomains tools send your private key and OpenAI key to `api.agentipy.fun` (the "encryption" key comes from that same server). It stays installed for reference only.
