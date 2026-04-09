import fs from 'fs';
import path from 'path';

const CONFIG = {
    IGNORE_DIRS: new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.vscode', '.idea', 'venv', '__pycache__', '.pytest_cache']),
    TARGET_EXTS: new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.cs']),
    OUTPUT_FILE: 'PROJECT_MEMORY.md'
};

const EXTRACTORS = {
    js: (line) => {
        let m = line.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([\w_]+)\s*\(/);
        if (m) return `f() ${m[1]}`;
        m = line.match(/(?:export\s+)?const\s+([\w_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^\s=]+)\s*=>/);
        if (m) return `f() ${m[1]}`;
        m = line.match(/(?:export\s+)?(?:default\s+)?class\s+([\w_]+)/);
        if (m) return `class ${m[1]}`;
        return null;
    },
    py: (line) => {
        let m = line.match(/^ *def ([\w_]+)\s*\(/);
        if (m) return `f() ${m[1]}`;
        m = line.match(/^ *class ([\w_]+)\s*[:(]/);
        if (m) return `class ${m[1]}`;
        return null;
    },
    cs: (line) => {
        let m = line.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?[\w<>,_]+\s+([\w_]+)\s*\(/);
        const exclude = ['if', 'switch', 'for', 'foreach', 'while', 'catch'];
        if (m && !exclude.includes(m[1].toLowerCase())) return `f() ${m[1]}`;
        m = line.match(/(?:public|private|protected|internal)?\s*(?:static\s+)?(?:abstract|sealed)?\s*class\s+([\w_]+)/);
        if (m) return `class ${m[1]}`;
        return null;
    }
};

EXTRACTORS.ts = EXTRACTORS.js;
EXTRACTORS.jsx = EXTRACTORS.js;
EXTRACTORS.tsx = EXTRACTORS.js;

function getFileType(ext) {
    return ext.replace('.', '');
}

function walkDir(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (!CONFIG.IGNORE_DIRS.has(file)) {
                walkDir(filePath, fileList);
            }
        } else {
            const ext = path.extname(file);
            if (CONFIG.TARGET_EXTS.has(ext)) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

function parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const ext = getFileType(path.extname(filePath));
    const extractor = EXTRACTORS[ext];
    
    if (!extractor) return [];

    const entities = [];
    lines.forEach((line) => {
        const signature = extractor(line);
        if (signature) entities.push(`\`${signature}\``);
    });

    return entities;
}

function generateTextTree(filesMap, baseDir) {
    const tree = {};
    for (const fPath of Object.keys(filesMap)) {
        const parts = path.relative(baseDir, fPath).split(path.sep);
        let curr = tree;
        for (const part of parts) {
            if (!curr[part]) curr[part] = {};
            curr = curr[part];
        }
    }

    let out = '## System Structure\n```text\n';
    function printTree(node, prefix = '') {
        const keys = Object.keys(node);
        keys.forEach((key, index) => {
            const isLast = index === keys.length - 1;
            out += `${prefix}${isLast ? '└── ' : '├── '}${key}\n`;
            if (Object.keys(node[key]).length > 0) {
                printTree(node[key], prefix + (isLast ? '    ' : '│   '));
            }
        });
    }
    printTree(tree);
    out += '```\n\n';
    return out;
}

function run() {
    const startDir = process.cwd();
    console.log(`Scanning: ${startDir}`);

    const files = walkDir(startDir);
    const filesMap = {};
    let totalEntities = 0;

    files.forEach(f => {
        const entities = parseFile(f);
        if (entities.length > 0) {
            filesMap[f] = entities;
            totalEntities += entities.length;
        }
    });

    let md = `# Project Reference\n\n`;
    md += `Files: ${Object.keys(filesMap).length} | Entities: ${totalEntities}\n\n`;
    
    md += generateTextTree(filesMap, startDir);
    
    md += `## File Registry\n\n`;
    md += `| File | Exports/Entities |\n`;
    md += `| --- | --- |\n`;

    for (const [fPath, entities] of Object.entries(filesMap)) {
        if (entities.length === 0) continue;
        const relPath = path.relative(startDir, fPath).replace(/\\/g, '/');
        const eStrs = entities.join(', ');
        md += `| ${relPath} | ${eStrs} |\n`;
    }

    const outPath = path.join(startDir, CONFIG.OUTPUT_FILE);
    fs.writeFileSync(outPath, md, 'utf-8');
    
    console.log(`Done. Saved to: ${outPath}`);
}

run();
