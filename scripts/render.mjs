// Generate the two repository indexes and 100 case pages from the shared catalog.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8'));
const check = process.argv.includes('--check');
const site = 'https://beatapi.io';
const gallery = '/kling-image-4-0-prompts';
const detail = '/prompts/kling-image-4-0';
const official = 'https://kling.ai/quickstart/kling-image-4-user-guide';
const categories = {
  'image-set': ['Coordinated image sets', '连续组图'],
  'long-image': ['Ecommerce & website long images', '电商与网页长图'],
  typography: ['Typography & layout', '文字排版'],
  'reference-edit': ['Reference-guided editing', '参考图编辑'],
  photography: ['Photography & character design', '摄影与角色设计'],
};
const items = [...data.examples, ...data.prompts];
const ids = new Set();
const prompts = new Set();
const outputs = new Set();

function require(condition, message) {
  if (!condition) throw new Error(message);
}

require(data.model === 'Kling Image 4.0', 'Incorrect model');
require(data.examples.length >= 50 && data.prompts.length >= 50, 'Expected at least 50 source examples and 50 prompts');
require(data.examples.every((item) => item.itemType === 'example'), 'Source example in the wrong section');
require(data.prompts.every((item) => item.itemType === 'template'), 'Template in the wrong section');

for (const item of items) {
  require(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) && !ids.has(item.slug), `Duplicate or invalid slug: ${item.slug}`);
  ids.add(item.slug);
  require(Object.hasOwn(categories, item.category), `Unknown category: ${item.slug}`);
  require(['en', 'zh', 'ja'].every((locale) => item.title[locale]?.trim()), `Missing title: ${item.slug}`);
  if (item.itemType === 'example') {
    require(item.source.startsWith(official + '#:~:text='), `Missing source locator: ${item.slug}`);
    require(item.outputs.length > 0, `Missing source output: ${item.slug}`);
    for (const url of [...item.outputs, ...item.references]) {
      const asset = new URL(url);
      require(asset.protocol === 'https:' && asset.hostname.endsWith('.klingai-cdn-aws.com'), `Unexpected source image: ${url}`);
    }
    for (const output of item.outputs) {
      require(!outputs.has(output), `Duplicate source output: ${item.slug}`);
      outputs.add(output);
    }
  } else {
    require(item.prompt.trim().length > 60 && !prompts.has(item.prompt), `Missing or duplicate prompt: ${item.slug}`);
    prompts.add(item.prompt);
    const ids = [...item.prompt.matchAll(/@image_(\d+)/g)].map((match) => Number(match[1]));
    require(Math.max(0, ...ids) === item.referenceIds.length, `Unmatched references: ${item.slug}`);
    require(item.category !== 'image-set' || item.settings.images >= 2, `Missing set count: ${item.slug}`);
    require(item.settings.mode !== 'ecommerce' || item.referenceIds.length > 0, `Missing product input: ${item.slug}`);
  }
}

function output(path, contents) {
  const target = join(root, path);
  const next = contents.trimEnd() + '\n';
  if (check) {
    require(readFileSync(target, 'utf8') === next, `Generated file is stale: ${path}`);
  } else {
    writeFileSync(target, next);
  }
}

function galleryLink(lang) {
  return site + (lang === 'zh' ? '/zh' : '') + gallery;
}

function index(lang) {
  const cn = lang === 'zh';
  const title = cn ? 'Kling Image 4.0 提示词画廊' : 'Awesome Kling Image 4.0 Prompts';
  const lead = cn
    ? `按任务查找 ${data.examples.length} 条可灵官方案例和 ${data.prompts.length} 条可复制的原创 Prompt。官方案例在原指南中提供提示词和对应输出。原创 Prompt 附建议设置与参考图要求，当前为待实测模板。`
    : `Browse ${data.examples.length} source-linked Kling AI examples and ${data.prompts.length} original copyable prompts by task. Each official example links to its prompt and matching images. The original prompts include suggested settings and reference requirements and are awaiting generation tests.`;
  const lists = Object.entries(categories).map(([key, labels]) => {
    const rows = (list) => list.filter((item) => item.category === key)
      .map((item) => `- [${item.title[lang]}](cases/${item.slug}.md)`).join('\n');
    return `## ${labels[cn ? 1 : 0]}\n\n### ${cn ? '可灵官方案例' : 'Kling AI examples'}\n\n${rows(data.examples)}\n\n### ${cn ? '原创提示词' : 'Original prompts'}\n\n${rows(data.prompts)}`;
  });
  return `# ${title}\n\n![${cn ? 'BeatAPI 图库封面插画' : 'BeatAPI gallery cover illustration'}](assets/gallery-cover.webp)\n\n${lead}\n\n[${cn ? '打开 BeatAPI 图库' : 'Browse the BeatAPI gallery'}](${galleryLink(lang)}) · [${cn ? 'English' : '中文'}](${cn ? 'README.md' : 'README.zh-CN.md'}) · [${cn ? '提交案例' : 'Contribute'}](CONTRIBUTING.md)\n\n${lists.join('\n\n')}\n\n## ${cn ? '来源与复用' : 'Sources and reuse'}\n\n${cn ? '官方案例的提示词、输入图和输出图均指向可灵原始页面或源文件。原创提示词遵循本仓库许可。' : 'Official prompts, inputs and outputs link to the original Kling AI guide or its source files. The repository license covers the original templates.'} [${cn ? '可灵官方指南' : 'Kling AI guide'}](${official}) · [CC BY 4.0](LICENSE.md).\n\n${cn ? '以上目录由' : 'The indexes and case files are generated from'} [data/catalog.json](data/catalog.json)${cn ? ' 生成。' : '.'}`;
}

function casePage(item) {
  const siteLink = `[View on BeatAPI](${site}${detail}/${item.slug})`;
  const header = `# ${item.title.en}\n\n${item.title.zh} · ${item.title.ja}\n\n${siteLink} · [All cases](../README.md)`;
  const media = (urls, prefix) => urls.map((url, i) => `- [${prefix} ${i + 1}](${url})`).join('\n');
  if (item.itemType === 'example') {
    const references = item.references.length ? `\n\n## Reference inputs\n\n${media(item.references, 'Reference')}` : '';
    return `${header}\n\nKling Image 4.0 · Official example published by Kling AI\n\n[Read the original prompt in the Kling AI guide](${item.source})\n\n## Published outputs\n\n${media(item.outputs, 'Output')}${references}`;
  }
  const settings = Object.entries(item.settings).map(([key, value]) => `- \`${key}\` · ${value}`).join('\n');
  const references = item.referenceIds.length
    ? `\n\n## Reference inputs to provide\n\n${item.referenceIds.map((id, i) => `- \`@image_${i + 1}\` · ${id.replaceAll('-', ' ')}`).join('\n')}`
    : '';
  return `${header}\n\nKling Image 4.0 · Original prompt template · Awaiting generation tests\n\n## Prompt\n\n\`\`\`text\n${item.prompt}\n\`\`\`\n\n## Suggested settings\n\n${settings}${references}`;
}

if (!check) mkdirSync(join(root, 'cases'), { recursive: true });
output('README.md', index('en'));
output('README.zh-CN.md', index('zh'));
for (const item of items) output(`cases/${item.slug}.md`, casePage(item));
require(readdirSync(join(root, 'cases')).filter((file) => file.endsWith('.md')).length === items.length, 'Unexpected case files');
console.log(`Validated ${data.examples.length} source examples and ${data.prompts.length} original prompts`);
