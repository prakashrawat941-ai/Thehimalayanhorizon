/** Fix old relative paths like "./img/x.jpg" from the current site's database. */
export function imgUrl(url) {
    if (!url)
        return null;
    if (url.startsWith('./'))
        return url.slice(1);
    return url;
}
