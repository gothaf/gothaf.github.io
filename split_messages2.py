import json
from datetime import datetime

# Load the JSON data
with open('/home/extremist/Downloads/chatgpt/infj/jsonData.json', 'r') as file:
    data = json.load(file)

# Function to convert timestamp to date
def timestamp_to_date(timestamp):
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')

# Dictionary to store the first message ID for each date
date_to_first_message_id = {}

# Iterate through the messages
for message_id, message_data in data[0]['mapping'].items():
    if message_data.get('message') and message_data['message'].get('create_time'):
        create_time = message_data['message']['create_time']
        if create_time is not None:
            date = timestamp_to_date(create_time)
            if date not in date_to_first_message_id:
                date_to_first_message_id[date] = message_id

# Print the results
for date, message_id in date_to_first_message_id.items():
    print(f"Date: {date}, First Message ID: {message_id}")