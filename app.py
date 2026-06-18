import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from flask import Flask, jsonify, render_template, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    try:
        # Request with a modern User-Agent to avoid getting blocked
        req = urllib.request.Request(
            FEED_URL,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
        
        # Parse XML
        root = ET.fromstring(xml_data)
        
        # Atom feed namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title_el = entry.find('atom:title', ns)
            updated_el = entry.find('atom:updated', ns)
            content_el = entry.find('atom:content', ns)
            link_el = entry.find('atom:link', ns)
            id_el = entry.find('atom:id', ns)
            
            date_title = title_el.text if title_el is not None else "Untitled Release"
            updated_str = updated_el.text if updated_el is not None else ""
            raw_content = content_el.text if content_el is not None else ""
            
            # Extract link href
            link = ""
            if link_el is not None:
                link = link_el.attrib.get('href', '')
                
            entry_id = id_el.text if id_el is not None else ""
            
            # Format the date for human reading
            formatted_date = date_title
            if updated_str:
                try:
                    # Parse standard ISO format (e.g. 2026-06-17T12:00:00Z)
                    clean_date_str = updated_str.replace('Z', '+00:00')
                    dt = datetime.fromisoformat(clean_date_str)
                    formatted_date = dt.strftime('%B %d, %Y')
                except Exception:
                    pass
            
            # Split raw_content by <h3>...</h3> tags
            import re
            parts = re.split(r'(<h3>[^<]+</h3>)', raw_content)
            
            sub_entries = []
            if len(parts) <= 1:
                sub_entries.append(('general', raw_content))
            else:
                # parts[0] is content before the first h3 (usually empty or whitespace)
                # Then pairs follow: parts[i] is <h3>...</h3>, parts[i+1] is content
                i = 1
                while i < len(parts):
                    h3_tag = parts[i]
                    h3_text = re.sub(r'<[^>]+>', '', h3_tag).strip()
                    body_content = parts[i+1] if (i+1) < len(parts) else ""
                    sub_entries.append((h3_text, body_content))
                    i += 2
            
            for idx, (update_label, body_html) in enumerate(sub_entries):
                body_html = body_html.strip()
                if not body_html and update_label == 'general':
                    continue
                
                # Determine type of update based on label or content
                label_lower = update_label.lower()
                update_type = "general"
                
                if "feature" in label_lower:
                    update_type = "feature"
                elif "fix" in label_lower or "resolved" in label_lower or "issue" in label_lower or "bug" in label_lower:
                    update_type = "fix"
                elif "change" in label_lower or "update" in label_lower or "modify" in label_lower:
                    update_type = "change"
                elif "deprecat" in label_lower or "remove" in label_lower or "obsolete" in label_lower or "breaking" in label_lower:
                    update_type = "deprecation"
                elif "announcement" in label_lower:
                    update_type = "general"
                elif "general availability" in label_lower or "ga" in label_lower:
                    update_type = "ga"
                
                # Extract clean title from description
                plain_text = re.sub(r'<[^>]+>', ' ', body_html)
                plain_text = ' '.join(plain_text.split()).strip()
                
                # Get the first sentence
                sentences = re.split(r'(?<=[.!?])\s+', plain_text)
                if sentences and sentences[0]:
                    title = sentences[0].strip()
                    if len(title) > 100:
                        title = title[:97] + "..."
                else:
                    title = f"{update_label} Update"
                
                # Construct unique sub-id
                sub_id = f"{entry_id}#{update_type}-{idx}"
                
                entries.append({
                    'id': sub_id,
                    'title': title,
                    'updated': updated_str,
                    'date_formatted': formatted_date,
                    'content': body_html,
                    'link': link,
                    'type': update_type
                })
            
        return {
            'success': True,
            'entries': entries,
            'count': len(entries),
            'fetched_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'entries': []
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    data = fetch_and_parse_feed()
    if not data['success']:
        return jsonify(data), 500
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
