// scripts/parseUtils.js

/**
 * decodeHtmlEntities
 *  - A simple helper that decodes common HTML entities
 *    WITHOUT stripping out existing tags.
 */
export function decodeHtmlEntities(str) {
	return str
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

/**
 * decodeAndFormatText
 *  - Decodes HTML entities
 *  - Replaces markdown-like syntax (e.g. **bold**, *italic*)
 *  - etc.
 */
export function decodeAndFormatText(rawStr) {
	let decodedString = decodeHtmlEntities(rawStr);

	// Convert dash-lines -> <ul>...
	decodedString = decodedString.replace(/(?:^-\s.*\n?)+/gm, (match) => {
		const trimmed = match.trimEnd();
		const items = trimmed.split('\n').map((line) => {
			return line.replace(/^-+\s+(.*)$/, '<li>$1</li>');
		});
		return `<ul>\n${items.join('\n')}\n</ul>\n`;
	});

	// Bold
	decodedString = decodedString.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	// Italic
	decodedString = decodedString.replace(/\*(.*?)\*/g, '<i>$1</i>');

	// Headings
	decodedString = decodedString.replace(/^\s*###\s+(.*)$/gm, '<h2>$1</h2>');
	decodedString = decodedString.replace(/^\s*##\s+(.*)$/gm, '<h2>$1</h2>');
	decodedString = decodedString.replace(/^### (.*)$/gm, '<h3>$1</h3>');
	decodedString = decodedString.replace(/^#### (.*)$/gm, '<h4>$1</h4>');

	// Remove certain emojis
	decodedString = decodedString.replace(/\uD83D\uDCA1|\uD83D\uDC49|\uD83D\uDD39|\ud83d\udd3b|\ud83d\udd25|\ud83c\udf1f|\u26a1/g, '');

	// Replace "fe0f 20e3" with "."
	decodedString = decodedString.replace(/\ufe0f\u20e3/g, '.');

	// Convert lines with exactly three dashes -> <hr>
	decodedString = decodedString.replace(/^---$/gm, '<hr>');

	return decodedString;
}

/**
 * parseTablesInText
 *
 * 1) Splits text into lines
 * 2) Finds blocks of consecutive table rows
 * 3) Converts them to <table> HTML
 */
export function parseTablesInText(rawText) {
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
export function convertTableLinesToHtml(tableLines) {
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
export function parseListsAndHeadings(text) {
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
