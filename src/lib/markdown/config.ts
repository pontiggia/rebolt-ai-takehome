import type { Options as RehypeSanitizeOptions } from 'rehype-sanitize';

export const sanitizeSchema: RehypeSanitizeOptions = {
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img'],
  tagNames: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'strong',
    'b',
    'em',
    'i',
    'del',
    's',
    'a',
    'input',
  ],
  attributes: {
    a: ['href'],
    code: ['className'],
    input: [['type', 'checkbox'], ['disabled', true], 'checked'],
    '*': [],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
  },
  allowComments: false,
  allowDoctypes: false,
};

export const remarkGfmOptions = {
  singleTilde: false,
};
