#!/usr/bin/env python3
"""Stream readable, wrapped user messages and Ask events from session JSONL files."""

import argparse
import json
from pathlib import Path


def emit(event: dict) -> None:
    for line in json.dumps(event, ensure_ascii=False, indent=2).split("\n"):
        for start in range(0, len(line), 120):
            print(line[start:start + 120])
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sessions", nargs="+", type=Path, help="Session JSONL files")
    args = parser.parse_args()

    for session in args.sessions:
        path = session.resolve()
        with path.open(encoding="utf-8") as records:
            for line_number, line in enumerate(records, start=1):
                record = json.loads(line)
                if record["type"] != "message":
                    continue
                message = record["message"]
                source = {"path": str(path), "line": line_number, "id": record["id"]}
                if message["role"] == "user":
                    emit({"kind": "user", "source": source, "content": message["content"]})
                elif message["role"] == "assistant":
                    for block in message["content"]:
                        if block["type"] == "toolCall" and block["name"] == "ask":
                            emit({"kind": "ask_call", "source": source, "call": block})
                elif message["role"] == "toolResult" and message["toolName"] == "ask":
                    emit({"kind": "ask_result", "source": source, "message": message})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
