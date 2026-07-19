// Placeholder home page — the frontend stage will overwrite this with
// the real product UI.

export default function Home() {
	return (
		<main
			style={{
				minHeight: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: 'system-ui, sans-serif',
				color: '#666',
				padding: '2rem',
				textAlign: 'center',
			}}
		>
			<div>
				<h1 style={{ marginBottom: '0.5rem', color: '#333', fontWeight: 500 }}>
					Building your app…
				</h1>
				<p style={{ margin: 0 }}>
					This placeholder is replaced by the frontend stage as soon as it lands.
				</p>
			</div>
		</main>
	);
}
