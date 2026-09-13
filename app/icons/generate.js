const sharp = require('sharp');
[80, 130, 256].forEach(size => {
  let name = '';
  if (size === 80) name = 'icon-small.png';
  else if (size === 130) name = 'icon-large.png';
  else name = 'largeIcon.png'; // according to instructions it's largeIcon.png
  sharp('icon.svg').resize(size, size).png().toFile(name);
});
