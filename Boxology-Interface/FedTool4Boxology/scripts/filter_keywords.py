import json

with open('../data/metadata.json', 'r') as f:
	data = json.load(f)
	print(data)

tag_ids = []
for entry in data:
	print(entry['tags'])
	for tag in entry['tags']:
		print(tag['id'])
		tag_ids.append(tag['id'])
print(tag_ids)

with open('../data/tags_old.csv', 'r', encoding="utf-8") as f:
	tags = f.readlines()
	print(tags)

new_tags = ['id,name,wikidata_link,dbpedia_link\n']

for tag in tags:
	print(tag)
	for id in tag_ids:
		print(id)
		if id != '' and id == tag.split(',')[0] and tag not in new_tags:
			new_tags.append(tag)
			print('match')

with open("../data/tags.csv", 'w', encoding="utf-8") as f:
	print(new_tags)
	f.writelines(new_tags)