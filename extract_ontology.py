import sys
import os
import json
import ollama
from pydantic import BaseModel

# 1. Define the exact JSON shape we want back from Ollama
class OntologyConcept(BaseModel):
    concept_name: str
    definition: str
    key_attributes: list[str]
    related_terms: list[str]

class FileOntology(BaseModel):
    concepts: list[OntologyConcept]

def parse_file(file_path):
    if not os.path.exists(file_path):
        return

    print(f"[Ontology Parser] Processing: {file_path}")
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 2. Get host IP dynamically if running inside WSL
    host_ip = os.popen("ip route | grep default | awk '{print $3}'").read().strip()
    client = ollama.Client(host=f"http://{host_ip}:11434")

    prompt = f"Extract all core philosophical, technical, or domain concepts from this document into structured JSON:\n\n{content}"

    # 3. Send prompt to local Qwen model using Structured Output
    try:
        response = client.chat(
            model="qwen2.5-coder:7b",
            messages=[{"role": "user", "content": prompt}],
            format=FileOntology.model_json_schema(),
            options={"temperature": 0}
        )

        extracted_data = response['message']['content']
        
        # 4. Append the extracted schema directly to your project's context rules
        output_path = ".cursor/rules/ontology-schema.mdc"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, "a", encoding="utf-8") as f:
            f.write(f"\n\n<!-- Extracted from {os.path.basename(file_path)} -->\n")
            f.write(f"```json\n{extracted_data}\n```")
            
        print(f"[Ontology Parser] Successfully updated {output_path}")

    except Exception as e:
        print(f"[Ontology Parser] Error connecting to Ollama: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        parse_file(sys.argv[1])


