const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy root static assets
const rootFiles = [
  'index.html',
  'Mustkill.ttf',
  'madn.png',
  'bg_symbol.png',
  'dlrjsms?.png',
  'Vector.png',
  'Cybertronian_Robot_S_#2-1787323879010.wav',
  'magnific_.-.-1-bayer-.-woodcut-eng_3zGuzv3REY.png',
  '이걸로 교체.png',
  '챌.png',
  'Frame 2085663880.png'
];

rootFiles.forEach(file => {
  const src = path.join(rootDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// Copy ss/dist -> dist/scripture
const ssDist = path.join(rootDir, 'ss', 'dist');
const scriptureDest = path.join(distDir, 'scripture');
if (fs.existsSync(ssDist)) {
  fs.cpSync(ssDist, scriptureDest, { recursive: true });
}

// Copy solva 복사본 2/dist -> dist/question
const solvaDist = path.join(rootDir, 'solva 복사본 2', 'dist');
const questionDest = path.join(distDir, 'question');
if (fs.existsSync(solvaDist)) {
  fs.cpSync(solvaDist, questionDest, { recursive: true });
}

console.log('Successfully assembled dist/ for deployment:');
console.log(' - Root: index.html + assets');
console.log(' - Scripture: dist/scripture');
console.log(' - Question: dist/question');
