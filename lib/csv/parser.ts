/**
 * RFC 4180 Compliant CSV Parser & Serializer
 */

export function parseCsv(text: string): string[][] {
  const p: string[][] = [[]];
  let row = p[0];
  let inQuotes = false;
  let currentToken = "";

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote: "" -> "
        currentToken += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push(currentToken.trim());
      currentToken = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && next === "\n") {
        i++;
      }
      row.push(currentToken.trim());
      currentToken = "";
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        p.push([]);
        row = p[p.length - 1];
      }
    } else {
      currentToken += c;
    }
  }

  if (currentToken.length > 0 || (row.length > 0 && row[0] !== "")) {
    row.push(currentToken.trim());
  }

  // Remove trailing empty rows
  return p.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

export function serializeCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((r) => r.map(escapeCell).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export function getSampleCsvTemplate(entityType: "leads" | "companies" | "contacts"): {
  filename: string;
  csv: string;
} {
  switch (entityType) {
    case "leads":
      return {
        filename: "leads_import_template.csv",
        csv: `firstName,lastName,email,phone,companyName,jobTitle,source,estimatedValue,rating,description
Jane,Doe,jane.doe@enterprise.com,+1 555-0192,Enterprise Solutions,CTO,Website,50000,Hot,Interested in cloud migration and SOC2
Robert,Smith,robert@acmecorp.com,+1 555-0144,Acme Corp,Procurement Director,Referral,35000,Warm,Follow up next quarter`,
      };
    case "companies":
      return {
        filename: "companies_import_template.csv",
        csv: `name,industry,website,email,phone,city,country,status,description
TechNova Systems,Software,https://technova.io,info@technova.io,+1 555-9876,Austin,USA,Customer,Enterprise SaaS provider
Beacon Logistics,Transportation,https://beaconlogistics.com,contact@beacon.com,+1 555-5432,Chicago,USA,Prospect,Regional freight provider`,
      };
    case "contacts":
      return {
        filename: "contacts_import_template.csv",
        csv: `firstName,lastName,email,phone,jobTitle,department,companyName
Alice,Vance,alice@technova.io,+1 555-1122,Head of Engineering,Engineering,TechNova Systems
Marcus,Brody,marcus@beacon.com,+1 555-3344,VP Operations,Logistics,Beacon Logistics`,
      };
  }
}
