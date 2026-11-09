import json
from pathlib import Path  # import Path from pathlib module

directory = Path('boxologies')  # set directory path
boxologies = []

for file in directory.iterdir():
    if file.is_file():  # Check if it's a file
        print(file)
        with open(file, 'r') as f:
            data = json.load(f)
            boxologies.append(data)

with open("../data/boxology.json", 'w') as f:
    json.dump({'boxologies': boxologies}, f)
