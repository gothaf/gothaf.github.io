// scripts/analytics.js

let localEventsQueue = [];

/**
 * Returns device info (type, resolution, model)
 */
function getDeviceInfo() {
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	const screenWidth = window.screen.width;
	const screenHeight = window.screen.height;
	const screenResolution = `${screenWidth}x${screenHeight}`;
	const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

	let model = 'Unknown Device';
	if (/iPhone/.test(userAgent)) {
		if (screenHeight === 844) model = 'iPhone 12/12 Pro';
		else if (screenHeight === 926) model = 'iPhone 12 Pro Max';
		else if (screenHeight === 896) model = 'iPhone XR/11';
		else if (screenHeight === 780) model = 'iPhone 13 Mini';
		else if (screenHeight === 852) model = 'iPhone 14';
		else if (screenHeight === 932) model = 'iPhone 14 Pro Max';
	} else if (/Android/.test(userAgent)) {
		model = 'Android Device';
	} else if (!isMobile) {
		model = 'Desktop/Laptop';
	}

	return {
		device_type: isMobile ? 'Mobile' : 'Desktop',
		screen_resolution: screenResolution,
		device_model: model,
	};
}

/**
 * Log an event locally and also send to Google Analytics if available.
 * @param {string} eventName - e.g. "scroll_start"
 * @param {string} eventLabel - e.g. "message-1"
 * @param {string} pageId
 */
export function logLocalEvent(eventName, eventLabel, pageId) {
	const deviceInfo = getDeviceInfo();

	localEventsQueue.push({
		event_name: eventName,
		event_label: eventLabel,
		page_id: pageId,
		timestamp: Date.now(),
		...deviceInfo,
	});

	// Also log to Google Analytics
	gtag('event', eventName, {
		event_category: 'engagement',
		event_label: eventLabel,
	});
}

/**
 * Send all events in the queue to the backend in one POST request.
 */
export function flushEvents() {
	if (localEventsQueue.length === 0) return;

	const eventsToSend = [...localEventsQueue];
	localEventsQueue = [];

	fetch('https://api.test.tradext.gr/github_pages/events.php', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ events: eventsToSend }),
	})
		.then((res) => res.json())
		.then((data) => {
			// console.log('Batched events sent:', data);
		})
		.catch((err) => {
			console.error('Error sending batched events:', err);
			// Optionally requeue
			// localEventsQueue = eventsToSend.concat(localEventsQueue);
		});
}

/**
 * Setup interval to flush every 2 seconds
 * (Call this once in main.js)
 */
export function startBatchFlushInterval() {
	setInterval(() => {
		flushEvents();
	}, 2000);
}

/**
 * Setup scroll tracking: IntersectionObserver + scroll events
 */
export function setupScrollTracking(pageId) {
	const messageElements = document.querySelectorAll('.message');

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && !entry.target.classList.contains('entered')) {
					logLocalEvent('scroll_start', entry.target.dataset.section, pageId);
					entry.target.classList.add('entered');
				}
			});
		},
		{ root: null, threshold: 0.01 }
	);

	messageElements.forEach((msg) => observer.observe(msg));

	window.addEventListener('scroll', () => {
		messageElements.forEach((msg) => {
			const rect = msg.getBoundingClientRect();
			const hasEnded = rect.bottom <= 0;

			if (hasEnded && !msg.classList.contains('ended')) {
				logLocalEvent('scroll_end', msg.dataset.section, pageId);
				msg.classList.add('ended');
			}
		});
	});
}
