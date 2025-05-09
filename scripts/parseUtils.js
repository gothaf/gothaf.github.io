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
	decodedString = decodedString.replace(/\uD83D\uDCA1|\uD83D\uDC49|\uD83D\uDD39|\ud83d\udd3b|\ud83d\udd25|\ud83c\udf1f|\ud83d\ude80|\ud83d\udc96|\u26a1/g, '');

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
/**
 * parseListsAndHeadings
 *
 * • detects block-quotes starting with "> "
 * • supports headings (####, ###, ##)
 * • handles ordered / unordered / nested lists by indentation
 * • leaves table-HTML intact
 */
export function parseListsAndHeadings(text) {
	const lines = text.split('\n');
	let html = '';
	let stack = []; // [{ type: 'ol' | 'ul', indent }]

	/* ---------- list helpers ---------- */
	function closeLastList() {
		if (stack.length) {
			const last = stack.pop();
			html += `</${last.type}>`;
		}
	}

	function closeListsToIndent(indent) {
		while (stack.length && stack[stack.length - 1].indent >= indent) {
			closeLastList();
		}
	}

	function openList(type, indent, startNum = null) {
		html += type === 'ol' && startNum !== null ? `<ol start="${startNum}">` : `<${type}>`;
		stack.push({ type, indent });
	}

	function handleListItem(indent, isOrdered, content, itemNumber = null) {
		if (!stack.length) {
			openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
		} else {
			let top = stack[stack.length - 1];

			if (top.type !== (isOrdered ? 'ol' : 'ul')) {
				closeListsToIndent(indent);
				openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
			} else if (top.indent < indent) {
				openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
			} else if (top.indent > indent) {
				closeListsToIndent(indent);
				top = stack[stack.length - 1] || {};
				if (top.type !== (isOrdered ? 'ol' : 'ul')) {
					openList(isOrdered ? 'ol' : 'ul', indent, isOrdered ? itemNumber : null);
				}
			}
		}

		html += isOrdered && itemNumber !== null ? `<li value="${itemNumber}">${decodeAndFormatText(content)}</li>` : `<li>${decodeAndFormatText(content)}</li>`;
	}
	/* ---------------------------------- */

	const tableTagRegex = /^(<table|<\/table|<tr|<\/tr|<td|<\/td|<thead|<\/thead|<tbody|<\/tbody|<th|<\/th)/i;

	for (let i = 0; i < lines.length; i++) {
		const rawLine = lines[i];
		const rightTrimmed = rawLine.replace(/\s+$/, '');
		if (!rightTrimmed) {
			// blank line
			while (stack.length) closeLastList();
			continue;
		}

		/* ---------- 1. block-quote ---------- */
		if (/^>\s+/.test(rightTrimmed.trimStart())) {
			while (stack.length) closeLastList(); // close any open lists

			// gather consecutive quote lines
			const quoteLines = [];
			let j = i;
			while (j < lines.length && /^>\s+/.test(lines[j].trimStart())) {
				quoteLines.push(lines[j].replace(/^>\s+/, '')); // strip "> "
				j++;
			}
			i = j - 1; // resume loop at the last quote line

			html += '<blockquote>';
			quoteLines.forEach((qLine) => {
				html += `<p>${decodeAndFormatText(qLine)}</p>`;
			});
			html += '</blockquote>';
			continue; // skip remaining checks for these lines
		}
		/* ------------------------------------ */

		/* ---------- 2. table-HTML ---------- */
		if (tableTagRegex.test(rightTrimmed.trimStart())) {
			while (stack.length) closeLastList();
			html += rightTrimmed + '\n';
			continue;
		}
		/* ------------------------------------ */

		const indent = (rightTrimmed.match(/^(\s+)/) || [''])[0].length;
		const line = rightTrimmed.trimStart();

		/* ---------- 3. headings ---------- */
		const h4 = line.match(/^####\s+(.*)/);
		if (h4) {
			while (stack.length) closeLastList();
			html += `<h4>${decodeAndFormatText(h4[1])}</h4>`;
			continue;
		}
		const h3 = line.match(/^###\s+(.*)/);
		if (h3) {
			while (stack.length) closeLastList();
			html += `<h3>${decodeAndFormatText(h3[1])}</h3>`;
			continue;
		}
		const h2 = line.match(/^##\s+(.*)/);
		if (h2) {
			while (stack.length) closeLastList();
			html += `<h2>${decodeAndFormatText(h2[1])}</h2>`;
			continue;
		}
		/* ----------------------------------- */

		/* ---------- 4. list items ---------- */
		const ol = line.match(/^(\d+)\.\s+(.*)/); // e.g. "1. item"
		if (ol) {
			handleListItem(indent, true, ol[2], parseInt(ol[1], 10));
			continue;
		}
		const ul = line.match(/^-\s+(.*)/); // e.g. "- item"
		if (ul) {
			handleListItem(indent, false, ul[1]);
			continue;
		}
		/* ----------------------------------- */

		/* ---------- 5. normal paragraph ---- */
		while (stack.length) closeLastList();
		html += `<p>${decodeAndFormatText(line)}</p>`;
	}

	// close any dangling lists
	while (stack.length) closeLastList();

	return html;
}
