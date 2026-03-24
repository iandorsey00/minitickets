import { createDefinitionAction, toggleDefinitionActiveAction } from "@/lib/actions";
import { getAdminData } from "@/lib/data";
import { localizeDefinition } from "@/lib/format";
import { PageHeader, Panel } from "@/components/ui";

function DefinitionTable({
  kind,
  title,
  items,
  locale,
  dictionary,
}: {
  kind: string;
  title: string;
  items: Array<{ id: string; key: string; labelZh: string; labelEn: string; isActive: boolean }>;
  locale: "ZH_CN" | "EN";
  dictionary: {
    common: {
      key: string;
      label: string;
      state: string;
      actions: string;
      active: string;
      inactive: string;
      disable: string;
      enable: string;
    };
  };
}) {
  return (
    <Panel title={title}>
      <table className="table">
        <thead>
          <tr>
            <th>{dictionary.common.key}</th>
            <th>{dictionary.common.label}</th>
            <th>{dictionary.common.state}</th>
            <th>{dictionary.common.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.key}</td>
              <td>{localizeDefinition(item, locale)}</td>
              <td>{item.isActive ? dictionary.common.active : dictionary.common.inactive}</td>
              <td>
                <form action={toggleDefinitionActiveAction}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="ghost-button">
                    {item.isActive ? dictionary.common.disable : dictionary.common.enable}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export default async function AdminCatalogPage() {
  const data = await getAdminData();
  if (!data) {
    return <div />;
  }
  const t = data.dictionary;

  return (
    <>
      <PageHeader title={t.admin.catalog} subtitle={t.admin.createDefinition} />
      <Panel title={t.admin.createDefinition}>
        <form action={createDefinitionAction} className="filters">
          <div className="field">
            <label htmlFor="kind">{t.common.kind}</label>
            <select id="kind" name="kind" defaultValue="category">
              <option value="status">{t.common.status}</option>
              <option value="priority">{t.common.priority}</option>
              <option value="category">{t.common.category}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="key">{t.common.key}</label>
            <input id="key" name="key" required />
          </div>
          <div className="field">
            <label htmlFor="labelZh">简体中文</label>
            <input id="labelZh" name="labelZh" required />
          </div>
          <div className="field">
            <label htmlFor="labelEn">English</label>
            <input id="labelEn" name="labelEn" required />
          </div>
          <div className="field">
            <label htmlFor="sortOrder">{t.common.sortOrder}</label>
            <input id="sortOrder" name="sortOrder" type="number" defaultValue={99} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button type="submit">{t.common.create}</button>
          </div>
        </form>
      </Panel>

      <div className="grid-3">
        <DefinitionTable
          kind="status"
          title={t.common.status}
          items={data.definitions.statuses}
          locale={data.locale}
          dictionary={t}
        />
        <DefinitionTable
          kind="priority"
          title={t.common.priority}
          items={data.definitions.priorities}
          locale={data.locale}
          dictionary={t}
        />
        <DefinitionTable
          kind="category"
          title={t.common.category}
          items={data.definitions.categories}
          locale={data.locale}
          dictionary={t}
        />
      </div>
    </>
  );
}
