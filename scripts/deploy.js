const { execSync } = require('child_process');
const path = require('path');

// Ensure environment is set to production
process.env.NODE_ENV = 'production';

console.log('Building project...');
execSync('npm run build', { stdio: 'inherit' });

console.log('Running deployment checks...');
// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'pipe' });
} catch (error) {
  console.error('Vercel CLI not found. Installing...');
  execSync('npm install -g vercel', { stdio: 'inherit' });
}

console.log('Deploying to Vercel...');
try {
  execSync('vercel --prod', { stdio: 'inherit' });
  console.log('✅ Deployment successful!');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
} 