import { publicOpen, db, parseRecord } from '../../../../packages/core/src/db.mjs'
export const dynamic = 'force-dynamic'
export default function Embed() {
  const open = publicOpen()
  const items = open
    ? db()
        .prepare("SELECT title,fields FROM records WHERE kind='portfolio'")
        .all()
        .map(parseRecord)
        .filter((r: any) => r.fields.published)
    : []
  return (
    <main className="embed-page">
      <div className="embed-brand">
        <img src="/rose-jade.png" alt="Fictional Rose Jade AI character" />
        <div>
          <span className="eyebrow">ROSE JADE AI™</span>
          <h1>A little introduction.</h1>
          <p>Approved public portfolio highlights.</p>
        </div>
      </div>
      {!open ? (
        <p>Temporary public portfolio access has ended.</p>
      ) : items.length ? (
        items.map((p: any, i: number) => (
          <article className="panel" key={i}>
            <h2>{p.title}</h2>
            <p>{p.fields.summary}</p>
            {p.fields.url && (
              <a className="text-link" href={p.fields.url} target="_blank" rel="noreferrer">
                Explore project ↗
              </a>
            )}
          </article>
        ))
      ) : (
        <p>No portfolio entries have been published.</p>
      )}
      <p className="fine">
        Read-only public information. Private assistant conversations and memories are never
        embedded.
      </p>
    </main>
  )
}
