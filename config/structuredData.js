// JSON-LD je Seitentyp (ein Block pro Seite). Inhalte wie im Original, Dubletten entfallen (B14).
import site from '../src/_data/site.json' with { type: 'json' };

const publisher = {
  '@type': 'Organization',
  name: site.name,
  url: site.url,
  logo: { '@type': 'ImageObject', url: `${site.url}/favicon.svg` },
};

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${site.url}/#author`,
  name: site.author,
  url: site.url,
  sameAs: [site.linkedin, site.scholar, site.orcid],
  jobTitle: site.jobTitle,
};

const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  url: site.url,
  description: site.description,
  inLanguage: 'en',
  publisher,
};

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${site.url}${path}` })),
  };
}

// options: { type, url, metaTitle, title, description, image, date, modified, section, crumbs }
export function structuredData({ type, url, metaTitle, title, description, image, date, modified, section, crumbs = [] }) {
  const pageUrl = `${site.url}${url}`;
  switch (type) {
    case 'collection':
      return [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: metaTitle,
          description,
          url: pageUrl,
          isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
          inLanguage: 'en',
        },
        breadcrumbs([['Home', '/'], ...crumbs]),
      ];
    case 'article':
      return [
        person,
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          '@id': `${pageUrl}#article`,
          headline: title,
          description,
          url: pageUrl,
          mainEntityOfPage: pageUrl,
          image: `${site.url}${image}`,
          datePublished: new Date(date).toISOString(),
          dateModified: new Date(modified ?? date).toISOString(),
          author: { '@id': `${site.url}/#author`, '@type': 'Person', name: site.author, sameAs: [site.linkedin, site.scholar, site.orcid] },
          publisher,
          inLanguage: 'en',
          articleSection: section,
          isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
        },
        breadcrumbs([['Home', '/'], [title, url]]),
      ];
    case 'tool':
      return [
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: title,
          description,
          url: pageUrl,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Any (web browser)',
          isAccessibleForFree: true,
          author: { '@id': `${site.url}/#author` },
          inLanguage: 'en',
        },
        breadcrumbs([['Home', '/'], ['Tools', '/tools/'], [title, url]]),
      ];
    default:
      return [website, person];
  }
}
