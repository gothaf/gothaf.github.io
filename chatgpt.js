/*********************************************
 * Batching Setup
 *********************************************/

// 1) An array to store local events until they are flushed
let localEventsQueue = [];

// 2) A function to log events locally (and also call gtag)
function logLocalEvent(eventName, eventLabel, pageId) {
	// Store the event for batching
	localEventsQueue.push({
		event_name: eventName,
		event_label: eventLabel,
		page_id: pageId,
		timestamp: Date.now(),
	});

	// Also send to Google Analytics if it's not blocked
	gtag('event', eventName, {
		event_category: 'engagement',
		event_label: eventLabel,
	});
}

// 3) A function to flush the queue in one POST request
function flushEvents() {
	if (localEventsQueue.length === 0) {
		// Nothing to send
		return;
	}

	// Copy the queue; then clear it
	const eventsToSend = [...localEventsQueue];
	localEventsQueue = [];

	fetch('https://api.test.tradext.gr/github_pages/events.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ events: eventsToSend }),
	})
		.then((res) => res.json())
		.then((data) => {
			console.log('Batched events sent successfully:', data);
		})
		.catch((err) => {
			console.error('Error sending batched events:', err);

			// Optionally re-queue if you want to retry
			// localEventsQueue = eventsToSend.concat(localEventsQueue);
		});
}

// 4) Flush every 2 seconds
setInterval(() => {
	flushEvents();
}, 2000);

/*********************************************
 * Existing ChatGPT code
 *********************************************/

function loadJSONFile(jsonFilePath, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', jsonFilePath, true);
	xhr.responseType = 'json';

	xhr.onload = function () {
		if (xhr.status >= 200 && xhr.status < 300) {
			callback(null, xhr.response);
		} else {
			callback(new Error('Failed to load JSON file: ' + xhr.status));
		}
	};

	xhr.onerror = function () {
		callback(new Error('Network error while loading JSON file'));
	};

	xhr.send();
}

document.addEventListener('DOMContentLoaded', () => {
	const scriptTag = document.querySelector('script#data-config');
	const jsonFilePath = scriptTag?.getAttribute('src');

	// 1) Read the meta property or document title
	const metaTag = document.querySelector('meta[name="page-id"]');
	const pageId = metaTag ? metaTag.content : 'Unknown';

	if (jsonFilePath) {
		loadJSONFile(jsonFilePath, (error, jsonData) => {
			if (error) {
				console.error(error);
			} else {
				initializeChatWithData(jsonData);
				loadSidebar(pageId);

				// Pass pageId to scroll tracking so we can logLocalEvent with it
				setupScrollTracking(pageId);
			}
		});
	} else {
		console.error('JSON file path is not specified in the HTML.');
	}

	// Alternatively, get the <title>:
	const pageTitle = document.title || 'Untitled';

	// 2) Log page load event to your server (one-off immediate call)
	fetch('https://api.test.tradext.gr/github_pages/events.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			page_id: pageId,
		}),
	})
		.then((response) => response.json())
		.then((data) => {
			// console.log('Logged page load:', data);
		})
		.catch((err) => {
			console.error('Error logging page load:', err);
		});
});

document.addEventListener('click', (event) => {
	// If a thumbnail was clicked
	if (event.target.matches('.thumbnail')) {
		const imageContainer = event.target.closest('.image-container');
		const overlay = imageContainer.querySelector('.full-image-overlay');
		overlay.classList.remove('hidden');
	}

	// If the close button or the overlay background was clicked
	if (
		event.target.matches('.close-overlay') ||
		event.target.classList.contains('full-image-overlay') // optional: close if background is clicked
	) {
		const overlay = event.target.closest('.full-image-overlay');
		overlay.classList.add('hidden');
	}
});

function getConversationMessages(conversation) {
	var messages = [];
	var currentNode = conversation.current_node;

	while (currentNode != null) {
		var node = conversation.mapping[currentNode];

		// Basic checks (node.message exists, etc.)
		if (node.message && node.message.content && node.message.content.parts && node.message.content.parts.length > 0 && (node.message.author.role !== 'system' || node.message.metadata.is_user_system_message)) {
			if (node.message.recipient === 'all') {
				// Determine the author
				let author = node.message.author.role;
				if (author === 'assistant' || author === 'tool') {
					author = 'ChatGPT';
				} else if (author === 'system' && node.message.metadata.is_user_system_message) {
					author = 'Custom user info';
				}

				// Gather attachments (if any)
				let attachments = [];
				if (node.message.metadata && node.message.metadata.attachments) {
					attachments = node.message.metadata.attachments
						.filter((att) => att.mime_type === 'application/pdf')
						.map((att) => {
							return {
								id: att.id,
								size: att.size,
								name: att.name,
								mime_type: att.mime_type,
								file_token_size: att.file_token_size,
							};
						});
				}

				// If message has content_references, store them
				let contentRefs = [];
				if (node.message.metadata && node.message.metadata.content_references) {
					contentRefs = node.message.metadata.content_references;
				}

				// Check content type or attachments
				const contentType = node.message.content.content_type;
				if (contentType === 'text' || contentType === 'multimodal_text' || attachments.length > 0) {
					// Gather message "parts" (text, transcripts, images, etc.)
					var parts = [];
					for (var i = 0; i < node.message.content.parts.length; i++) {
						var part = node.message.content.parts[i];
						if (typeof part === 'string' && part.length > 0) {
							parts.push({ text: part });
						} else if (part.content_type === 'audio_transcription') {
							parts.push({ transcript: part.text });
						} else if (part.content_type === 'audio_asset_pointer' || part.content_type === 'image_asset_pointer' || part.content_type === 'video_container_asset_pointer') {
							parts.push({ asset: part });
						} else if (part.content_type === 'real_time_user_audio_video_asset_pointer') {
							if (part.audio_asset_pointer) {
								parts.push({ asset: part.audio_asset_pointer });
							}
							if (part.video_container_asset_pointer) {
								parts.push({ asset: part.video_container_asset_pointer });
							}
							for (var j = 0; j < part.frames_asset_pointers.length; j++) {
								parts.push({ asset: part.frames_asset_pointers[j] });
							}
						}
					}

					let createTime = node.message.create_time || null;

					// Only push the message if there's something to display
					if (parts.length > 0 || attachments.length > 0) {
						messages.push({
							author,
							parts,
							createTime,
							attachments, // now included in each message object
							contentRefs,
						});
					}
				}
			}
		}

		currentNode = node.parent;
	}

	return messages.reverse();
}

// A helper function that decodes HTML entities,
// then converts **text** to <strong>text</strong>.
function decodeAndFormatText(rawStr) {
	// 1) Decode minimal HTML entities without removing tags:
	//    i.e. turn "&lt;" -> "<", "&gt;" -> ">", "&amp;" -> "&", etc.
	let decodedString = decodeHtmlEntities(rawStr);

	// 2) Group consecutive dash-lines into a single <ul> block:
	decodedString = decodedString.replace(/(?:^-\s.*\n?)+/gm, (match) => {
		const trimmed = match.trimEnd();
		const items = trimmed.split('\n').map((line) => {
			return line.replace(/^-+\s+(.*)$/, '<li>$1</li>');
		});
		return `<ul>\n${items.join('\n')}\n</ul>\n`;
	});

	// 3) Convert **...** to <strong>...</strong>
	decodedString = decodedString.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

	// 4) Convert *...* to <i>...</i>
	decodedString = decodedString.replace(/\*(.*?)\*/g, '<i>$1</i>');

	// 5) Convert lines that start with "##" or "###" into <h2> or <h3> (etc.)
	decodedString = decodedString.replace(/^\s*###\s+(.*)$/gm, '<h2>$1</h2>');
	decodedString = decodedString.replace(/^\s*##\s+(.*)$/gm, '<h2>$1</h2>');
	decodedString = decodedString.replace(/^### (.*)$/gm, '<h3>$1</h3>');
	decodedString = decodedString.replace(/^#### (.*)$/gm, '<h4>$1</h4>');

	// 6) Remove certain emojis
	decodedString = decodedString.replace(/\uD83D\uDCA1|\uD83D\uDC49|\uD83D\uDD39|\ud83d\udd3b|\ud83d\udd25|\ud83c\udf1f|\u26a1/g, '');

	// 7) Replace "fe0f 20e3" with "."
	decodedString = decodedString.replace(/\ufe0f\u20e3/g, '.');

	// 8) Convert lines that contain exactly three dashes into <hr>
	decodedString = decodedString.replace(/^---$/gm, '<hr>');

	return decodedString;
}

/**
 * decodeHtmlEntities
 *
 * A simple helper that decodes common HTML entities
 * WITHOUT stripping out existing tags.
 */
function decodeHtmlEntities(str) {
	return str
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

/**
 * parseTablesInText
 *
 * 1) Splits text into lines
 * 2) Finds blocks of consecutive table rows
 * 3) Converts them to <table> HTML
 */
function parseTablesInText(rawText) {
	// Split into lines
	const lines = rawText.split('\n');
	let html = '';
	let i = 0;

	while (i < lines.length) {
		let line = lines[i];

		// Trim right side but keep left spaces if you need them for nesting logic
		const trimmed = line.trimEnd();

		// If this line looks like a table row (begins with '|' and has another '|')
		if (/^\|.*\|/.test(trimmed)) {
			// We found the start of a table. Gather consecutive lines that match table pattern.
			let tableLines = [];
			while (i < lines.length && /^\|.*\|/.test(lines[i].trimEnd())) {
				tableLines.push(lines[i].trimEnd());
				i++;
			}
			// Now convert those lines to a single <table> block
			html += convertTableLinesToHtml(tableLines);
		} else {
			// Not a table line, just add it as a normal line or pass it to your existing parser
			html += trimmed + '\n';
			i++;
		}
	}

	return html;
}

/**
 * convertTableLinesToHtml
 *
 * Takes an array of table-like lines, e.g.:
 * [
 *   "| **INFJ** | **ENFJ** |",
 *   "|----------|----------|",
 *   "| Dominant: Ni | Dominant: Fe |"
 * ]
 * and returns a <table>...</table> block.
 */
function convertTableLinesToHtml(tableLines) {
	// We'll create one <thead> row (optional), then <tbody> for the rest
	// Or keep it simple: just do a <tbody> for everything
	// Identify if the second line is a '---|---' kind of separator
	// We'll skip that line when building rows.

	// Example approach:
	let htmlTable = '<div class="table-wrapper"><table><tbody>';

	// If there's a second line that looks like a separator row, skip it
	// We check something like /^[|\s-]+$/ to see if it's all '|', '-', or spaces
	const hasHeaderSeparator = tableLines.length > 1 && /^[|\s-]+$/.test(tableLines[1].trim());

	// We'll parse line by line
	for (let idx = 0; idx < tableLines.length; idx++) {
		// If it's the second line and it is a separator row, skip it
		if (idx === 1 && hasHeaderSeparator) {
			continue;
		}

		// Split on '|', remove the first empty element and the last empty element if any
		let cells = tableLines[idx].split('|');
		// Typically in Markdown, the split might produce an empty string at index 0 & last
		// if the line starts and ends with '|'. So let's trim them if they're empty:
		if (cells[0].trim() === '') cells.shift();
		if (cells[cells.length - 1].trim() === '') cells.pop();

		// For the "header row" vs. "body rows", you could do:
		// If idx=0 and hasHeaderSeparator => treat them as <th>
		const isHeader = idx === 0 && hasHeaderSeparator;

		// Build the row
		let rowHtml = '<tr>';
		cells.forEach((cell) => {
			// Apply your existing transformations on the cell content, e.g.
			// parseListsAndHeadings(cell)
			let cellContent = parseListsAndHeadings(cell.trim());
			rowHtml += isHeader ? `<th>${cellContent}</th>` : `<td>${cellContent}</td>`;
		});
		rowHtml += '</tr>\n';

		htmlTable += rowHtml;
	}

	htmlTable += '</tbody></table></div>\n';
	return htmlTable;
}

/**
 * parseListsAndHeadings
 * - Detects lines that start with "#### " -> <h4>
 * - Lines that start with a digit + "." -> ordered list item
 * - Lines that start with "-" -> unordered list item
 * - Indentation determines nesting levels (based on multiples of 2 or 4 spaces).
 */
function parseListsAndHeadings(text) {
	const lines = text.split('\n');
	let html = '';
	let stack = []; // will hold objects { type: 'ol'|'ul', indent: number }

	// Helper to close the last list on the stack
	function closeLastList() {
		if (stack.length > 0) {
			const last = stack.pop();
			html += `</${last.type}>`;
		}
	}

	// Helper to close lists until indent is matched or stack is empty
	function closeListsToIndent(indent) {
		while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
			closeLastList();
		}
	}

	// Modified openList to allow an optional start number
	function openList(type, indent, startNum = null) {
		if (type === 'ol' && startNum !== null) {
			// if you want the list to begin at "startNum"
			html += `<ol start="${startNum}">`;
		} else {
			html += `<${type}>`;
		}
		stack.push({ type, indent });
	}

	// Function to handle a line that is a list item
	// Now accepts "itemNumber" for ordered lists.
	function handleListItem(line, indent, isOrdered, content, itemNumber = null) {
		// Determine if we need to open or close lists
		if (stack.length === 0) {
			// Not in a list yet, open one
			// For ordered: pass itemNumber to openList
			openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
		} else {
			let top = stack[stack.length - 1];
			if (top.type !== (isOrdered ? 'ol' : 'ul')) {
				// Close until we can open the desired list
				closeListsToIndent(indent);
				openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
			} else {
				// same type, check indent
				if (top.indent < indent) {
					// open a nested list
					openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
				} else if (top.indent > indent) {
					// close higher indent lists
					closeListsToIndent(indent);
					// if now the top is not the right type, open a new one
					top = stack[stack.length - 1];
					if (!top || top.type !== (isOrdered ? 'ol' : 'ul')) {
						openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
					}
				}
			}
		}

		// Now add the <li> item.
		// If it's an ordered list item, set value="itemNumber"
		if (isOrdered && itemNumber !== null) {
			html += `<li value="${itemNumber}">${decodeAndFormatText(content)}</li>`;
		} else {
			html += `<li>${decodeAndFormatText(content)}</li>`;
		}
	}

	// Regex to detect lines that begin with common table-related tags
	// so we skip them (they're already HTML <table>, <tr>, <td>, etc.)
	const tableTagRegex = /^(<table|<\/table|<tr|<\/tr|<td|<\/td|<thead|<\/thead|<tbody|<\/tbody|<th|<\/th)/i;

	for (let i = 0; i < lines.length; i++) {
		let rawLine = lines[i];

		// Trim right side but preserve left indentation for nesting
		let rightTrimmed = rawLine.replace(/\s+$/, '');
		if (!rightTrimmed) {
			// An empty line -> close all open lists
			while (stack.length > 0) {
				closeLastList();
			}
			continue;
		}

		// Count leading spaces for indentation
		let matchIndent = rightTrimmed.match(/^(\s+)/);
		let indent = matchIndent ? matchIndent[1].length : 0;

		// Now we remove the leading spaces to parse content
		let line = rightTrimmed.trimStart();

		// 1) If the line starts with a table tag, just keep it as-is
		if (tableTagRegex.test(line)) {
			// Close any open lists
			while (stack.length > 0) {
				closeLastList();
			}
			// Keep the table code intact
			html += line + '\n';
			continue;
		}

		// 2) Heading "#### "
		let headingMatch = line.match(/^####\s+(.*)/);
		if (headingMatch) {
			// Close any open lists first
			while (stack.length > 0) {
				closeLastList();
			}
			html += `<h4>${decodeAndFormatText(headingMatch[1])}</h4>`;
			continue;
		}

		// 3) Ordered list item: "1. Something"
		let olMatch = line.match(/^(\d+)\.\s+(.*)/);
		if (olMatch) {
			let itemNumber = parseInt(olMatch[1], 10); // parse the numeric prefix
			let content = olMatch[2];
			handleListItem(line, indent, true, content, itemNumber);
			continue;
		}

		// 4) Unordered list item: "- Something"
		let ulMatch = line.match(/^-\s+(.*)/);
		if (ulMatch) {
			let content = ulMatch[1];
			handleListItem(line, indent, false, content);
			continue;
		}

		// 5) If it doesn't match a heading or list or table,
		//    treat as a normal paragraph.
		while (stack.length > 0) {
			closeLastList();
		}

		html += `<p>${decodeAndFormatText(line)}</p>`;
	}

	// End of all lines -> close any lists still open
	while (stack.length > 0) {
		closeLastList();
	}

	return html;
}

var assetsJson = {
	'file-service://file-62tGUeckVNgDo7VxUuAMab': 'file-62tGUeckVNgDo7VxUuAMab-A3C5A976-44A7-4EEF-8355-558E41F3C5F8.jpeg',
};

/* NEW FUNCTION:
   applyContentReferences(text, contentReferences)
   - Loops over contentReferences in descending order (so replacements don't alter string indices).
   - For each reference:
     - if type='hidden', remove the matched_text from `text`
     - if type='grouped_webpages', replace matched_text with an <a> link (or multiple links if "items" has multiple)
     - if type='video', replace matched_text with an <a><img/></a> or whatever you want
*/
/**
 * applyContentReferencesByText
 *
 * Looks for the exact `matched_text` in `text` and replaces it
 * based on the reference type.
 */
function applyContentReferences(text, contentReferences) {
	// Sort references in descending order of start_idx so we replace from end to start
	// to avoid messing up subsequent indices.
	const sortedRefs = [...contentReferences].sort((a, b) => b.start_idx - a.start_idx);
	//console.log('SORTED REFS', sortedRefs);

	let modifiedText = text;

	sortedRefs.forEach((ref) => {
		const { type, matched_text, start_idx, end_idx } = ref;

		if (!matched_text || start_idx == null || end_idx == null) {
			return;
		}

		let replacement = '';

		switch (type) {
			case 'hidden':
				// simply remove this text (replace with empty string)
				replacement = '';
				break;

			case 'grouped_webpages':
				// If we have 'items', pick the first or multiple?
				// Let's assume we show the first one for simplicity
				if (ref.items && ref.items.length > 0) {
					const item = ref.items[0];
					// item.attribution or item.title for link text?
					// We'll use the item.attribution as text
					const linkText = item.attribution || 'External Link';
					const linkUrl = item.url || '#';
					replacement = `<a href="${linkUrl}" target="_blank" rel="noopener" class="custom-link"><span class="truncate">${linkText}</span></a>`;
				}
				break;

			case 'video':
				const videoId = ref.video_id;
				const videoSite = ref.video_site;
				if (videoId) {
					// build embed iframe
					replacement = `
			 <div class="mb-3">
  <div class="responsive-video-container">
				  <iframe class="aspect-video w-full rounded-lg" src="https://www.youtube.com/embed/${videoId}"	frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerpolicy="strict-origin-when-cross-origin"
					allowfullscreen
				  ></iframe>
				</div>
			  </div>
			  `;
				}

				break;

			// You can handle other types if needed
			default:
				// Do nothing
				break;
		}

		// Replace the matched substring [start_idx, end_idx) in `modifiedText`
		// with the replacement. Note that end_idx is presumably the character
		// AFTER the match, so we slice up to that index.
		// Double-check the off-by-one logic if needed.
		const before = modifiedText.slice(0, start_idx);
		const after = modifiedText.slice(end_idx);
		modifiedText = before + replacement + after;
	});

	return modifiedText;
}

// on load, add messages to the root div
// On load, build balloon-styled chat
function initializeChatWithData(jsonData) {
	var root = document.getElementById('root');
	for (var i = 0; i < jsonData.length; i++) {
		var conversation = jsonData[i];
		var messages = getConversationMessages(conversation);
		var convDiv = document.createElement('div');
		convDiv.className = 'conversation';
		convDiv.innerHTML = '<h4>' + conversation.title + '</h4>';

		// Loop through messages and create balloon style
		messages.forEach(function (msg, index) {
			var messageContainer = document.createElement('div');
			messageContainer.className = 'message';
			// Add the data-section attribute
			messageContainer.setAttribute('data-section', `message-${index + 1}`);

			// Assign a class for alignment based on author
			// (user / chatgpt / custom user info)
			const lowerAuthor = msg.author.toLowerCase().replace(/\s+/g, ' ');
			if (lowerAuthor.includes('chatgpt')) {
				messageContainer.classList.add('chatgpt');
			} else if (lowerAuthor.includes('custom')) {
				messageContainer.classList.add('custom', 'user', 'info');
			} else {
				// treat everything else as user
				messageContainer.classList.add('user');
			}

			// Create an element for the author label or icon
			var authorDiv = document.createElement('div');
			authorDiv.className = 'author';

			// If it's ChatGPT, we’ll do a special layout
			if (lowerAuthor.includes('chatgpt')) {
				//messageContainer.appendChild(authorDiv);

				//
				// 2) For ChatGPT’s actual "bubble" content, we create
				//    a container with two child divs:
				//    - One for the same SVG or icon (left side),
				//      though you might omit it if you prefer the top author icon only.
				//    - One for the text (right side).
				//
				//    If you only want one place for the icon (the top or the left),
				//    adjust to your preference.
				//
				msg.parts.forEach(function (part) {
					// We create ONE bubble container with a flex layout
					// so the icon is on the left, the message text on the right
					let bubble = document.createElement('div');
					bubble.className = 'bubble';

					// "bubble-content-chatgpt" is a flex container
					let bubbleContent = document.createElement('div');
					bubbleContent.className = 'bubble-content-chatgpt';

					// Left side: an icon wrapper (re-using the same SVG or a simpler icon).
					// If you prefer not to duplicate the icon, you can omit this entirely.
					let svgWrapper = document.createElement('div');
					svgWrapper.className = 'chatgpt-icon-wrapper';
					svgWrapper.innerHTML = `
  <div class="gizmo-bot-avatar flex h-8 w-8 items-center justify-center overflow-hidden rounded-full"><div class="relative p-1 rounded-sm flex items-center justify-center bg-token-main-surface-primary text-token-text-primary h-8 w-8">
<svg width="41" height="41" viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-md" role="img"><text x="-9999" y="-9999">ChatGPT</text><path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.676 8.68622C35.6126 6.83404 33.9882 5.3676 32.0373 4.4985C30.0864 3.62941 27.9098 3.40259 25.8215 3.85078C24.8796 2.7893 23.7219 1.94125 22.4257 1.36341C21.1295 0.785575 19.7249 0.491269 18.3058 0.500197C16.1708 0.495044 14.0893 1.16803 12.3614 2.42214C10.6335 3.67624 9.34853 5.44666 8.6917 7.47815C7.30085 7.76286 5.98686 8.3414 4.8377 9.17505C3.68854 10.0087 2.73073 11.0782 2.02839 12.312C0.956464 14.1591 0.498905 16.2988 0.721698 18.4228C0.944492 20.5467 1.83612 22.5449 3.268 24.1293C2.81966 25.4759 2.66413 26.9026 2.81182 28.3141C2.95951 29.7256 3.40701 31.0892 4.12437 32.3138C5.18791 34.1659 6.8123 35.6322 8.76321 36.5013C10.7141 37.3704 12.8907 37.5973 14.9789 37.1492C15.9208 38.2107 17.0786 39.0587 18.3747 39.6366C19.6709 40.2144 21.0755 40.5087 22.4946 40.4998C24.6307 40.5054 26.7133 39.8321 28.4418 38.5772C30.1704 37.3223 31.4556 35.5506 32.1119 33.5179C33.5027 33.2332 34.8167 32.6547 35.9659 31.821C37.115 30.9874 38.0728 29.9178 38.7752 28.684C39.8458 26.8371 40.3023 24.6979 40.0789 22.5748C39.8556 20.4517 38.9639 18.4544 37.5324 16.8707ZM22.4978 37.8849C20.7443 37.8874 19.0459 37.2733 17.6994 36.1501C17.7601 36.117 17.8666 36.0586 17.936 36.0161L25.9004 31.4156C26.1003 31.3019 26.2663 31.137 26.3813 30.9378C26.4964 30.7386 26.5563 30.5124 26.5549 30.2825V19.0542L29.9213 20.998C29.9389 21.0068 29.9541 21.0198 29.9656 21.0359C29.977 21.052 29.9842 21.0707 29.9867 21.0902V30.3889C29.9842 32.375 29.1946 34.2791 27.7909 35.6841C26.3872 37.0892 24.4838 37.8806 22.4978 37.8849ZM6.39227 31.0064C5.51397 29.4888 5.19742 27.7107 5.49804 25.9832C5.55718 26.0187 5.66048 26.0818 5.73461 26.1244L13.699 30.7248C13.8975 30.8408 14.1233 30.902 14.3532 30.902C14.583 30.902 14.8088 30.8408 15.0073 30.7248L24.731 25.1103V28.9979C24.7321 29.0177 24.7283 29.0376 24.7199 29.0556C24.7115 29.0736 24.6988 29.0893 24.6829 29.1012L16.6317 33.7497C14.9096 34.7416 12.8643 35.0097 10.9447 34.4954C9.02506 33.9811 7.38785 32.7263 6.39227 31.0064ZM4.29707 13.6194C5.17156 12.0998 6.55279 10.9364 8.19885 10.3327C8.19885 10.4013 8.19491 10.5228 8.19491 10.6071V19.808C8.19351 20.0378 8.25334 20.2638 8.36823 20.4629C8.48312 20.6619 8.64893 20.8267 8.84863 20.9404L18.5723 26.5542L15.206 28.4979C15.1894 28.5089 15.1703 28.5155 15.1505 28.5173C15.1307 28.5191 15.1107 28.516 15.0924 28.5082L7.04046 23.8557C5.32135 22.8601 4.06716 21.2235 3.55289 19.3046C3.03862 17.3858 3.30624 15.3413 4.29707 13.6194ZM31.955 20.0556L22.2312 14.4411L25.5976 12.4981C25.6142 12.4872 25.6333 12.4805 25.6531 12.4787C25.6729 12.4769 25.6928 12.4801 25.7111 12.4879L33.7631 17.1364C34.9967 17.849 36.0017 18.8982 36.6606 20.1613C37.3194 21.4244 37.6047 22.849 37.4832 24.2684C37.3617 25.6878 36.8382 27.0432 35.9743 28.1759C35.1103 29.3086 33.9415 30.1717 32.6047 30.6641C32.6047 30.5947 32.6047 30.4733 32.6047 30.3889V21.188C32.6066 20.9586 32.5474 20.7328 32.4332 20.5338C32.319 20.3348 32.154 20.1698 31.955 20.0556ZM35.3055 15.0128C35.2464 14.9765 35.1431 14.9142 35.069 14.8717L27.1045 10.2712C26.906 10.1554 26.6803 10.0943 26.4504 10.0943C26.2206 10.0943 25.9948 10.1554 25.7963 10.2712L16.0726 15.8858V11.9982C16.0715 11.9783 16.0753 11.9585 16.0837 11.9405C16.0921 11.9225 16.1048 11.9068 16.1207 11.8949L24.1719 7.25025C25.4053 6.53903 26.8158 6.19376 28.2383 6.25482C29.6608 6.31589 31.0364 6.78077 32.2044 7.59508C33.3723 8.40939 34.2842 9.53945 34.8334 10.8531C35.3826 12.1667 35.5464 13.6095 35.3055 15.0128ZM14.2424 21.9419L10.8752 19.9981C10.8576 19.9893 10.8423 19.9763 10.8309 19.9602C10.8195 19.9441 10.8122 19.9254 10.8098 19.9058V10.6071C10.8107 9.18295 11.2173 7.78848 11.9819 6.58696C12.7466 5.38544 13.8377 4.42659 15.1275 3.82264C16.4173 3.21869 17.8524 2.99464 19.2649 3.1767C20.6775 3.35876 22.0089 3.93941 23.1034 4.85067C23.0427 4.88379 22.937 4.94215 22.8668 4.98473L14.9024 9.58517C14.7025 9.69878 14.5366 9.86356 14.4215 10.0626C14.3065 10.2616 14.2466 10.4877 14.2479 10.7175L14.2424 21.9419ZM16.071 17.9991L20.4018 15.4978L24.7325 17.9975V22.9985L20.4018 25.4983L16.071 22.9985V17.9991Z" fill="currentColor"></path></svg></div></div>
`;

					// Right side: text wrapper
					let textWrapper = document.createElement('div');
					textWrapper.className = 'chatgpt-text-wrapper';

					// Prepare the part’s text
					let bubbleHtml = '';
					if (part.text) {
						let decoded = part.text;

						if (msg.contentRefs.length > 0) {
							// 2) apply content references by string matching
							decoded = applyContentReferences(part.text, msg.contentRefs);
						}
						// 3) parse tables
						let intermediate = parseTablesInText(decoded);

						// 4) parse lists/headings
						let finalHtml = parseListsAndHeadings(intermediate);

						bubbleHtml = finalHtml;
					} else if (part.transcript) {
						// same as above but for transcript
						let intermediate = parseListsAndHeadings(part.transcript);
						let finalHtml = parseTablesInText(intermediate);
						bubbleHtml = '[Transcript]: ' + finalHtml;
					} else if (part.asset) {
						const link = assetsJson[part.asset.asset_pointer];
						if (link) {
							bubbleHtml = `[File]: <a href="${link}">${link}</a>`;
						} else {
							bubbleHtml = '[File]: -Deleted-';
						}
					}

					// Put the text into the text wrapper
					textWrapper.innerHTML = bubbleHtml;

					// Append icon + text to the bubbleContent
					bubbleContent.appendChild(svgWrapper);
					bubbleContent.appendChild(textWrapper);

					// Put bubbleContent inside the bubble
					bubble.appendChild(bubbleContent);

					// Finally, append bubble to the messageContainer
					messageContainer.appendChild(bubble);
				});
			} else if (lowerAuthor.includes('custom')) {
				// If it's custom user info
				authorDiv.textContent = msg.author;
				messageContainer.appendChild(authorDiv);

				// Normal balloon for each part
				msg.parts.forEach(function (part) {
					let bubble = document.createElement('div');
					bubble.className = 'bubble';

					let bubbleHtml = '';
					if (part.text) {
						bubbleHtml = parseListsAndHeadings(part.text);
					} else if (part.transcript) {
						bubbleHtml = '[Transcript]: ' + parseListsAndHeadings(part.transcript);
					} else if (part.asset) {
						const link = assetsJson[part.asset.asset_pointer];
						if (link) {
							bubbleHtml = `[File]: <a href="${link}">${link}</a>`;
						} else {
							bubbleHtml = '[File]: -Deleted-';
						}
					}
					bubble.innerHTML = bubbleHtml;
					messageContainer.appendChild(bubble);
				});
			} else {
				// For normal users
				authorDiv.textContent = msg.author;
				//messageContainer.appendChild(authorDiv);

				// Create balloons as before
				msg.parts.forEach(function (part) {
					let bubble = document.createElement('div');
					bubble.className = 'bubble';

					let bubbleHtml = '';
					if (part.text) {
						bubbleHtml = parseListsAndHeadings(part.text);
						bubble.innerHTML = bubbleHtml;
						messageContainer.appendChild(bubble);
					} else if (part.transcript) {
						bubbleHtml = '[Transcript]: ' + parseListsAndHeadings(part.transcript);
						bubble.innerHTML = bubbleHtml;
						messageContainer.appendChild(bubble);
					} else if (part.asset) {
						const link = assetsJson[part.asset.asset_pointer];
						if (link) {
							// Instead of a bubble, we'll create a "image-wrapper"
							let imageWrapper = document.createElement('div');
							imageWrapper.className = 'image-wrapper';

							imageWrapper.innerHTML = `
								  <div class="image-container">
									<img class="thumbnail" src="${link}" alt="image thumbnail" />
									<div class="full-image-overlay hidden">
									  <img class="full-image" src="${link}" alt="full image" />
									  <button class="close-overlay">&times;</button>
									</div>
								  </div>
								`;

							// Append the imageWrapper directly to messageContainer
							messageContainer.appendChild(imageWrapper);
						} else {
							// Possibly handle the missing asset scenario
							let noFileDiv = document.createElement('div');
							noFileDiv.textContent = '[File]: -Deleted-';
							messageContainer.appendChild(noFileDiv);
						}
					}
				});

				// --- Render ATTACHMENTS (if any) ---
				if (msg.attachments && msg.attachments.length > 0) {
					let attachmentsContainer = document.createElement('div');
					attachmentsContainer.className = 'attachments-container';

					msg.attachments.forEach((att) => {
						// Create a wrapper for each attachment
						let attDiv = document.createElement('div');
						attDiv.className = 'attachment-item';

						// Check mime type to decide how to display
						if (att.mime_type && att.mime_type.startsWith('image/')) {
							// If it's an image, show a thumbnail or the actual image
							attDiv.innerHTML = `
							  <div class="attachment-thumb">
								  <img src="${mapAttachmentIdToFileURL(att.id)}" 
									  alt="${att.name}" 
									  class="attachment-image" />
							  </div>
							  <div class="attachment-name">${att.name}</div>
							`;
						} else if (att.mime_type === 'application/pdf') {
							// If it's a PDF, show PDF icon + name + link
							attDiv.innerHTML = `
  <div class="relative overflow-hidden border border-token-border-light text-sm bg-token-main-surface-primary rounded-xl">
    <div class="p-2 w-80">
      <div class="flex flex-row items-center gap-2">
        <!-- Icon block -->
        <div class="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
          <!-- The same PDF icon SVG -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" class="h-10 w-10 flex-shrink-0" width="36" height="36">
            <rect width="36" height="36" rx="6" fill="#FF5588"></rect>
            <path d="M19.6663 9.66663H12.9997C12.5576 9.66663 12.1337 9.84222 11.8212 10.1548C11.5086 10.4673 11.333 10.8913 11.333 11.3333V24.6666C11.333 25.1087 11.5086 25.5326 11.8212 25.8451C12.1337 26.1577 12.5576 26.3333 12.9997 26.3333H22.9997C23.4417 26.3333 23.8656 26.1577 24.1782 25.8451C24.4907 25.5326 24.6663 25.1087 24.6663 24.6666V14.6666L19.6663 9.66663Z"
              stroke="white" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M19.667 9.66663V14.6666H24.667" stroke="white" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M21.3337 18.8334H14.667" stroke="white" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M21.3337 22.1666H14.667" stroke="white" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M16.3337 15.5H15.5003H14.667" stroke="white" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>

        <!-- Text: file name + extension -->
        <div class="overflow-hidden">
          <div class="truncate font-semibold">${att.name}</div>
          <div class="truncate text-token-text-secondary">PDF</div>
        </div>
      </div>
    </div>
  </div>
`;
						} else {
							// Generic file
							attDiv.innerHTML = `
							  <div class="attachment-icon generic-icon">FILE</div>
							  <div class="attachment-name">
								  <a href="${mapAttachmentIdToFileURL(att.id)}" target="_blank">
									  ${att.name}
								  </a>
							  </div>
							`;
						}

						attachmentsContainer.appendChild(attDiv);
					});

					messageContainer.appendChild(attachmentsContainer);
				}
			}

			// After building all parts in this message, append a timestamp.
			if (msg.createTime) {
				const formattedTime = formatDateTime(msg.createTime);

				let timeStampDiv = document.createElement('div');
				// We'll add a "timestamp" class for base styling
				timeStampDiv.classList.add('timestamp');

				// Align ChatGPT's time on the left, user's on the right
				if (lowerAuthor.includes('chatgpt')) {
					timeStampDiv.classList.add('timestamp-left');
				} else {
					timeStampDiv.classList.add('timestamp-right');
				}

				timeStampDiv.textContent = formattedTime;
				messageContainer.appendChild(timeStampDiv);
			}
			convDiv.appendChild(messageContainer);
		});

		root.appendChild(convDiv);
	}
}

/*********************************************
 * SCROLL TRACKING with Batching
 *********************************************/

function setupScrollTracking(pageId) {
	const messageElements = document.querySelectorAll('.message');

	// Create an Intersection Observer for "scroll_start"
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && !entry.target.classList.contains('entered')) {
					// Google Analytics call
					gtag('event', 'scroll_start', {
						event_category: 'engagement',
						event_label: entry.target.dataset.section,
					});

					// Also log to our local queue
					logLocalEvent('scroll_start', entry.target.dataset.section, pageId);

					// Mark as entered
					entry.target.classList.add('entered');
				}
			});
		},
		{
			root: null,
			rootMargin: '0px',
			threshold: 0.01,
		}
	);

	// Observe each message element
	messageElements.forEach((msg) => observer.observe(msg));

	// Add a scroll event listener to detect "scroll_end"
	window.addEventListener('scroll', () => {
		messageElements.forEach((msg) => {
			const rect = msg.getBoundingClientRect();
			const hasEnded = rect.bottom <= 0; // element is fully above the viewport

			if (hasEnded && !msg.classList.contains('ended')) {
				// Google Analytics call
				gtag('event', 'scroll_end', {
					event_category: 'engagement',
					event_label: msg.dataset.section,
				});

				// Also log to our local queue
				logLocalEvent('scroll_end', msg.dataset.section, pageId);

				msg.classList.add('ended');
			}
		});
	});
}

/*********************************************
 * loadSidebar code (unchanged)
 *********************************************/

function loadSidebar(pageId) {
	// Load sidebar and header

	var sidebarPath = pageId == 'main' ? './sidebar.html' : '../sidebar.html';

	fetch(sidebarPath)
		.then((response) => response.text())
		.then((html) => {
			// Inject the sidebar HTML
			document.getElementById('sidebar-container').innerHTML = html;

			// Add event listener to the hamburger button after the sidebar is loaded
			const hamburgerButton = document.getElementById('hamburger');
			const sidebar = document.getElementById('sidebar');

			if (hamburgerButton && sidebar) {
				hamburgerButton.addEventListener('click', () => {
					sidebar.classList.toggle('hidden');
				});
			} else {
				console.error('Sidebar or hamburger button not found in loaded HTML.');
			}

			// 1) Read the meta property or document title
			const metaTag = document.querySelector('meta[name="page-id"]');
			const pageId = metaTag ? metaTag.content : 'Unknown';

			if (pageId == 'main') {
				sidebar.classList.remove('hidden');
			}
		})
		.catch((error) => console.error('Error loading sidebar:', error));
}

/**
 * formatDateTime
 *
 * Returns only the time (HH:MM) if it's the same day as "now",
 * otherwise returns a short date + time string.
 *
 * @param {number} secondsSinceEpoch - message create_time in seconds
 * @returns {string} formatted date/time
 */
function formatDateTime(secondsSinceEpoch) {
	const dateObj = new Date(secondsSinceEpoch * 1000);
	const now = new Date();

	const sameDay = dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth() && dateObj.getDate() === now.getDate();

	if (sameDay) {
		// Show only time, e.g. "12:34"
		// You can customize with options: { hour: '2-digit', minute: '2-digit' }
		return 'Today, ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} else {
		// Show short date & time, e.g. "1/30/24, 12:34 PM"
		return dateObj.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	}
}

// Example: assetsJson usage or a direct mapping
function mapAttachmentIdToFileURL(attachmentId) {
	// If you have a dictionary of ID -> URL
	if (assetsJson[attachmentId]) {
		return assetsJson[attachmentId];
	}
	// Otherwise fallback
	return `./uploads/${attachmentId}`;
}
