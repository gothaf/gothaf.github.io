import json
from datetime import datetime
import os

# Load the JSON data
with open('/home/extremist/Downloads/chatgpt/infj/jsonData.json', 'r') as file:
    data = json.load(file)

# Function to convert timestamp to date
def timestamp_to_date(timestamp):
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')

# Dictionary to store messages grouped by date
messages_by_date = {}

# Iterate through the messages
for message_id, message_data in data[0]['mapping'].items():
    if message_data.get('message') and message_data['message'].get('create_time'):
        create_time = message_data['message']['create_time']
        if create_time is not None:
            date = timestamp_to_date(create_time)
            if date not in messages_by_date:
                messages_by_date[date] = []
            messages_by_date[date].append(message_data)

# Create a directory to store the output files
output_dir = '/home/extremist/Downloads/chatgpt/infj/output_by_date'
os.makedirs(output_dir, exist_ok=True)

# Save each group of messages to a separate JSON file
for date, messages in messages_by_date.items():
    output_file = os.path.join(output_dir, f'messages_{date}.json')
    with open(output_file, 'w') as file:
        json.dump(messages, file, indent=4)

print(f"Messages have been split and saved into separate files in {output_dir}")