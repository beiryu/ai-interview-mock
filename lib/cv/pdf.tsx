import path from "node:path"
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import type { Contact, CvContent } from "./schema"

/**
 * The tailored CV as a one-column PDF with real text (ATS-readable). Be
 * Vietnam Pro (OFL, lib/cv/fonts) because the built-in PDF fonts have no
 * Vietnamese diacritics.
 */

const FONT_DIR = path.join(process.cwd(), "lib/cv/fonts")
Font.register({
  family: "BeVietnamPro",
  fonts: [
    { src: path.join(FONT_DIR, "BeVietnamPro-Regular.ttf") },
    { src: path.join(FONT_DIR, "BeVietnamPro-SemiBold.ttf"), fontWeight: 600 },
  ],
})
// Keep words whole (no automatic hyphenation)
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: "BeVietnamPro",
    fontSize: 9.5,
    lineHeight: 1.4,
    padding: "34 40",
    color: "#111",
  },
  name: { fontSize: 18, fontWeight: 600, lineHeight: 1.2 },
  headline: { fontSize: 11, color: "#333", marginTop: 4, lineHeight: 1.3 },
  contact: {
    fontSize: 8.5,
    color: "#444",
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  contactItem: { marginRight: 10 },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    borderBottom: "0.6 solid #999",
    paddingBottom: 2,
    marginBottom: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  rowMain: { flex: 1, marginRight: 12, fontWeight: 600 },
  role: { fontWeight: 600 },
  period: { color: "#555", flexShrink: 0 },
  bullet: { flexDirection: "row", marginTop: 2, paddingLeft: 4 },
  dot: { width: 8 },
  bulletText: { flex: 1 },
  entry: { marginBottom: 7 },
})

export function CvDocument({
  cv,
  contact,
}: {
  cv: CvContent
  contact: Contact
}) {
  const contactItems = [
    contact.email,
    contact.phone,
    contact.location,
    ...contact.links,
  ].filter(Boolean)
  return (
    <Document title={`${contact.name} — CV`} author={contact.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.headline}>{cv.headline}</Text>
        <View style={styles.contact}>
          {contactItems.map((item) =>
            /^https?:\/\//.test(item) ? (
              <Link key={item} src={item} style={styles.contactItem}>
                {item.replace(/^https?:\/\/(www\.)?/, "")}
              </Link>
            ) : (
              <Text key={item} style={styles.contactItem}>
                {item}
              </Text>
            )
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text>{cv.summary}</Text>
        </View>

        {cv.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {cv.skills.map((group) => (
              <Text key={group.group}>
                <Text style={styles.role}>{group.group}: </Text>
                {group.items.join(", ")}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {cv.experience.map((e) => (
            <View key={e.id} style={styles.entry} wrap={false}>
              <View style={styles.row}>
                <Text style={styles.rowMain}>
                  {e.role} — {e.company}
                </Text>
                <Text style={styles.period}>{e.period}</Text>
              </View>
              {e.bullets.map((b) => (
                <View key={b.id} style={styles.bullet}>
                  <Text style={styles.dot}>•</Text>
                  <Text style={styles.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {cv.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {cv.education.map((ed) => (
              <View key={ed.school} style={styles.entry}>
                <View style={styles.row}>
                  <Text style={styles.rowMain}>
                    {ed.degree} — {ed.school}
                  </Text>
                  <Text style={styles.period}>{ed.period}</Text>
                </View>
                {ed.note && <Text>{ed.note}</Text>}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}

export function renderCvPdf(cv: CvContent, contact: Contact) {
  return renderToBuffer(<CvDocument cv={cv} contact={contact} />)
}
