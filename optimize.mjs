import sharp from 'sharp';
for (const name of ['taipei','jiufen','wulai']) await sharp(`public/${name}.jpg`).resize({width:1200,withoutEnlargement:true}).webp({quality:80}).toFile(`public/${name}.webp`);
