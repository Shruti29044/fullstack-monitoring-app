module.exports = {
	apps: [
		// Backend API (Express)
		{
			name: 'monitoring-api',
			cwd: './server',
			script: 'src/index.js',
			// ESM entry; no need for interpreter when running on Node >= 18
			exec_mode: 'fork',
			instances: 1,
			autorestart: true,
			env: {
				NODE_ENV: 'development',
				PORT: 3001,
			},
		},

		// Frontend (Vite dev server)
		{
			name: 'monitoring-web-dev',
			cwd: './web',
			script: 'npm',
			args: 'run dev',
			interpreter: 'none',
			exec_mode: 'fork',
			instances: 1,
			autorestart: true,
			env: {
				NODE_ENV: 'development',
				PORT: 5173,
			},
		},

		// Frontend (Vite preview for a simple prod-like run)
		{
			name: 'monitoring-web-preview',
			cwd: './web',
			script: 'npm',
			args: 'run preview',
			interpreter: 'none',
			exec_mode: 'fork',
			instances: 1,
			autorestart: true,
			env: {
				NODE_ENV: 'production',
				PORT: 5173,
			},
		},
	],
};


