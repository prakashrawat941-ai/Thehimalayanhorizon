import { Photo } from './Photo';
import '@/app/public-refresh.css';

// Page header for the refreshed public pages: photo behind the text on phones,
// text beside a photo card on laptops (so smaller photos stay sharp).
export function PageHero({ eyebrow, title, lead, photo, lang }) {
  return (
    <section className="rf-ph">
      {photo ? <Photo name={photo} lang={lang} alt="" eager className="rf-ph-bg"/> : null}
      <div className="wrap rf-ph-in">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {lead ? <p>{lead}</p> : null}
        </div>
        {photo ? <div className="rf-ph-card"><Photo name={photo} lang={lang} alt=""/></div> : null}
      </div>
    </section>
  );
}
