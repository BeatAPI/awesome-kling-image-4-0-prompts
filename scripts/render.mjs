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
const related = [
  ['MiniMax H3 Image', '/minimax-h3-image-prompts', 'awesome-minimax-h3-image-prompts'],
  ['Seedream 5.5', '/seedream-5-5-prompts', 'awesome-seedream-5-5-prompts'],
  ['GPT Image 2.6', '/gpt-image-2-6-prompts', 'awesome-gpt-image-2-6-prompts'],
  ['MiniMax H3 Video', '/minimax-h3-prompts', 'awesome-minimax-h3-prompts'],
];
const items = [...data.examples, ...data.prompts];
const ids = new Set();
const prompts = new Set();
const outputs = new Set();

function require(condition, message) {
  if (!condition) throw new Error(message);
}

require(data.model === 'Kling Image 4.0', 'Incorrect model');
require(data.examples.length >= 50 && data.prompts.length >= 50, 'Expected at least 50 source examples and 50 prompts');
require(new Set(data.community.map((item) => item.source)).size === data.community.length, 'Duplicate community source');
for (const item of data.community) {
  require(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(item.source), 'Invalid X post URL');
  if (item.promptSource) {
    require(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(item.promptSource), 'Invalid X prompt URL');
  }
}
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
  const promptSources = data.community.filter((item) => item.promptSource).length;
  const lead = cn
    ? `${data.featured.length} 条可查看原词和出图的精选工作流，${data.community.length} 条 X 社区作品（其中 ${promptSources} 条附作者提示词链接），以及 ${data.examples.length} 条可灵官方参考案例。`
    : `${data.featured.length} featured workflows with full prompts and outputs, ${data.community.length} creator examples on X (${promptSources} link to the original prompts), and ${data.examples.length} official Kling AI references.`;
  const jumpLinks = cn
    ? '[精选工作流](#精选工作流) · [社区原帖](#社区原帖) · [官方参考](#官方参考) · [原创模板](TEMPLATES.md)'
    : '[Featured workflows](#featured-workflows) · [Creator examples](#creator-examples-on-x) · [Official references](#official-references) · [Prompt templates](TEMPLATES.md)';
  const community = data.community.map((item) => {
    const prompt = item.promptSource ? ` · [${cn ? '原 Prompt' : 'Original prompt'}](${item.promptSource})` : '';
    const models = item.models?.length ? ` · ${item.models.join(' / ')}` : '';
    return `- [${item.title[lang]}](${item.source}) · ${item.author}${prompt}${models}`;
  }).join('\n');
  const featured = data.featured.map((item) => {
    const here = `${site}${cn ? '/zh' : ''}${detail}/${item.slug}`;
    const link = `<a href="${here}"><img src="${item.preview}" alt="${item.title[lang]}" width="420" /></a>`;
    // Tall output stays on the linked detail page, where it can be read at full size.
    return `### ${item.title[lang]}\n\n${cn ? '可灵官方案例' : 'Kling AI official example'} · [${cn ? '查看完整案例' : 'Open the full example'}](${here})${item.slug === 'ecommerce-long-form' ? '' : '\n\n' + link}`;
  }).join('\n\n');
  const more = related.map(([name, route, repo]) => `- [${name}](${site}${cn ? '/zh' : ''}${route}) · [GitHub](https://github.com/BeatAPI/${repo})`).join('\n');
  const lists = Object.entries(categories).map(([key, labels]) => {
    const rows = (list) => list.filter((item) => item.category === key)
      .map((item) => `- [${item.title[lang]}](cases/${item.slug}.md)`).join('\n');
    return `### ${labels[cn ? 1 : 0]}\n\n${rows(data.examples)}`;
  });
  return `<p align="center"><a href="${site}"><img src="./assets/readme-hero.png" alt="${cn ? 'Kling Image 4.0 提示词图库封面插画' : 'Kling Image 4.0 Prompt Gallery cover illustration'}" width="100%" /></a></p>\n\n# ${title}\n\n${lead}\n\n**[${cn ? 'BeatAPI 首页' : 'BeatAPI home'}](${site})** · **[${cn ? '浏览图库' : 'Browse the gallery'}](${galleryLink(lang)})** · **[${cn ? '模型预告' : 'Model preview'}](${site}${cn ? '/zh' : ''}/kling-4-0-image-api)** · **[${cn ? 'English' : '中文'}](${cn ? 'README.md' : 'README.zh-CN.md'})** · **[${cn ? '提交案例' : 'Contribute a case'}](https://github.com/BeatAPI/awesome-kling-image-4-0-prompts/issues/new?template=prompt.yml)**\n\n${jumpLinks}\n\n## ${cn ? '精选工作流' : 'Featured workflows'}\n\n${featured}\n\n## ${cn ? '社区原帖' : 'Creator examples on X'}\n\n${community}\n\n## ${cn ? '官方参考' : 'Official references'}\n\n${lists.join('\n\n')}\n\n[${cn ? '额外的 50 条待验证原创模板' : '50 additional original prompt templates awaiting tests'}](TEMPLATES.md)\n\n## ${cn ? '更多图库' : 'More galleries'}\n\n${more}\n\n## ${cn ? '来源与复用' : 'Sources and reuse'}\n\n${cn ? '官方案例的提示词、输入图和输出图均指向可灵原始页面或源文件。原创提示词遵循本仓库许可。' : 'Official prompts, inputs and outputs link to the original Kling AI guide or its source files. The repository license covers the original templates.'} [${cn ? '可灵官方指南' : 'Kling AI guide'}](${official}) · [CC BY 4.0](LICENSE.md).\n\n${cn ? '以上目录由' : 'The indexes and case files are generated from'} [data/catalog.json](data/catalog.json)${cn ? ' 生成。' : '.'}`;
}

function casePage(item) {
  const siteLink = `[Browse the BeatAPI gallery](${site}${gallery})`;
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
output('TEMPLATES.md', `# Original prompt templates\n\nThese templates include suggested settings and are awaiting generation tests.\n\n${data.prompts.map((item) => `- [${item.title.en}](cases/${item.slug}.md)`).join('\n')}`);
for (const item of items) output(`cases/${item.slug}.md`, casePage(item));
require(readdirSync(join(root, 'cases')).filter((file) => file.endsWith('.md')).length === items.length, 'Unexpected case files');
console.log(`Validated ${data.examples.length} source examples and ${data.prompts.length} original prompts`);
