import React from "react";
import { graphql, navigate } from "gatsby";
import { Col, Row } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import ReactPlayer from "react-player";
import booleanIntersects from "@turf/boolean-intersects";

import Layout from "../../components/layout/layout";
import ThumbnailMap from "../../components/map/thumbnailMap";
import SelectState from "../../components/selectState/selectState";
import OpoTable from "../../components/opoTable/opoTable";

import {
  findStateFeature,
  formatStateName,
  formatNumber,
} from "../../utils/utils";
import useDataMaps from "../../hooks/useDataMaps";
import content from "./[state].content.yml";

import * as styles from "./state.module.css";
import { FileEarmarkText, GraphUp } from "react-bootstrap-icons";

export default function State({ data: { statesGeoData }, state }) {
  const [{ opoDataMap, stateDataMap }] = useDataMaps();

  // Find associated state data and feature by abbreviation, redirect if not found
  const stateData = stateDataMap[state?.toLocaleUpperCase()];
  if (!stateData) {
    if (!state) return null;
    navigate("/404");
    return null;
  }

  const { headings, notes, stats, videos } = content;

  // const sources = Object.values(headings)
  //   .filter(heading => !!heading.source)
  //   .map(heading => heading.source);

  const notesByOpo = notes?.reduce(
    (notesMap, { note, tags }) => ({
      ...notesMap,
      ...tags.reduce(
        (_, tag) => ({ [tag]: [...(notesMap[tag] ?? []), note] }),
        {}
      ),
    }),
    {}
  );

  stateData.feature = findStateFeature(statesGeoData, stateData.abbreviation);

  // Use Turf to find bordering states by their geojson polygon
  const borderingStates = statesGeoData?.childGeoJson?.features
    ?.filter(feature => booleanIntersects(stateData.feature, feature))
    ?.map(({ properties: { abbreviation } }) => abbreviation);

  // Filter into in- and out-of-state (or neither); add region and notes (in), or formatted state list (out)
  const { inStateOpos, outOfStateOpos } = Object.values(opoDataMap).reduce(
    (filter, opo) => {
      // In state
      if (opo.statesWithRegions[stateData.abbreviation] !== undefined) {
        return {
          ...filter,
          inStateOpos: [
            ...filter.inStateOpos,
            {
              ...opo,
              // Add notes and region
              notes: notesByOpo[opo.opo],
              region: opo.statesWithRegions[stateData.abbreviation],
            },
          ],
        };
      } else if (borderingStates?.some(bs => opo.statesWithRegions[bs])) {
        // Out of state (but nearby)
        return {
          ...filter,
          outOfStateOpos: [
            ...filter.outOfStateOpos,
            // Add formatted state list
            { ...opo, states: Object.keys(opo.statesWithRegions).join(", ") },
          ],
        };
      } else {
        // Else, not nearby
        return filter;
      }
    },
    { inStateOpos: [], outOfStateOpos: [] }
  );

  // Popout stats
  const comps = inStateOpos
    .map(({ compensation }) => compensation)
    .filter(comp => !isNaN(parseInt(comp)));
  stateData.popoutStats = {
    avgCeoComp: comps.length
      ? Math.floor(comps.reduce((sum, comp) => sum + comp, 0) / comps.length)
      : 0,
    monthlyDead: stateData.monthly,
    waitlist: parseInt(stateData.waitlist),
  };
  // State-level the notes and videos
  stateData.allNotes = notes?.filter(({ tags }) =>
    tags.includes(stateData.abbreviation)
  );
  stateData.notes = stateData?.allNotes.filter(note => !note.voicesForReform);
  stateData.voicesForReform = stateData?.allNotes.filter(
    note => note.voicesForReform
  );
  stateData.videos = videos?.filter(({ tags }) =>
    tags.includes(stateData.abbreviation)
  );

  return (
    <Layout
      crumbLabel={formatStateName(stateData)}
      // sources must be in order they appear on the page
      sources={{...stats, ...headings}}
      social={true}
    >
      {/* State name, top-level stats, select state menu, and map */}
      <Row className={styles.hero}>
        <Row>
          <h2 className={styles.title}>{formatStateName(stateData)}</h2>
        </Row>
        <Row className={styles.serviceState}>
          <span>
            OPOs servicing {stateData.abbreviation}:{" "}
            <strong>{inStateOpos.length ?? 0}</strong>
          </span>
          <div className={styles.navToState}>
            <SelectState label={"See state data for:"} link={stateData.name} />
          </div>
        </Row>
        <Row className={styles.mapStats}>
          <Row className={styles.mapV2}>
            <ThumbnailMap
              dimensions={{ height: "16rem", width: "24rem" }}
              dataId={state}
              view="state"
            />
          </Row>
          <Row className={styles.stats}>
            <Row className={styles.statsHeading}>
              <Col className="ml-3">
                <h3>
                  <ReactMarkdown>{stats.waitlist.title}</ReactMarkdown>
                </h3>
              </Col>
              <Col>
                <h3 className="red">
                  <ReactMarkdown>{stats.monthly.title}</ReactMarkdown>
                </h3>
              </Col>
              <Col>
                <h3>
                  <ReactMarkdown>{stats.comp.title}</ReactMarkdown>
                </h3>
              </Col>
            </Row>
            <Row className={styles.statsPopout}>
              <Col className="ml-3">
                <p>{formatNumber(stateData.popoutStats.waitlist)}</p>
              </Col>
              <Col>
                <p className="red">
                  {formatNumber(stateData.popoutStats.monthlyDead)}
                </p>
              </Col>
              <Col>
                <p>
                  {formatNumber(stateData.popoutStats.avgCeoComp, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0,
                  })}
                </p>
              </Col>
            </Row>
          </Row>
        </Row>
      </Row>
      {/* OPOs servicing state */}
      <h2 className={styles.sectionHeader}> <FileEarmarkText />OPOS IN THIS STATE</h2>
      <Row className={styles.serviceTable}>
        {inStateOpos.length > 0 && (
          <OpoTable
          // suppress state column in the in-state OPO table
            headings={{...headings, states: null}}
            opos={inStateOpos}
            title={`OPOS Servicing ${stateData.name}`}
          />
        )}
      </Row>
      {/* News & notes (if exists) */}
      {stateData?.notes?.length > 0 && (
        <Row className={styles.news}>
          <Row>
            <h3>OPO News and Notes in {stateData.name}</h3>
          </Row>
          <Row>
            <ul>
              {stateData.notes.map(({ note }, i) => (
                <li key={`statewide-note-${i}`}>
                  <ReactMarkdown>{note}</ReactMarkdown>
                </li>
              ))}
            </ul>
          </Row>
        </Row>
      )}
      {/* Voices for reform (if exists) */}
      {stateData.videos?.length || stateData.voicesForReform?.length ? (
        <Row className={styles.voices}>
          <Row>
            <h3>Voices For Reform</h3>
          </Row>
          {stateData.voicesForReform?.length ? (
            <Row>
              <ul>
                {stateData.voicesForReform.map(({ note }, i) => (
                  <li key={"vfr-notes-" + i}>
                    <ReactMarkdown>{note}</ReactMarkdown>
                  </li>
                ))}
              </ul>
            </Row>
          ) : null}
          {stateData.videos?.length
            ? stateData.videos.map(({ link, title, description }, i) => (
                <Row key={`statewide-videos-${i}`} className={styles.video}>
                  <ReactPlayer url={link} width={594} height={361} />
                  <h4>{title}</h4>
                  {description && (
                    <ReactMarkdown className={styles.description}>
                      {description}
                    </ReactMarkdown>
                  )}
                </Row>
              ))
            : null}
        </Row>
      ) : null}
      {/* OPOs in neighboring states (if exists) */}
      <hr />
      <h2 className={styles.sectionHeader}> <GraphUp /> STATE DATA</h2>
      {outOfStateOpos.length > 0 && (
        <Row className={styles.serviceTable}>
          <OpoTable
            // pull states column to front and supress region column
            headings={{states: null, ...headings, region: null} }
            inState={false}
            opos={outOfStateOpos}
            title="OPO Performance in Neighboring States"
            captions={Object.values(headings)
              .filter(heading => !!heading.caption)
              .map(heading => heading.caption)
            }
          />
        </Row>
      )}
    </Layout>
  );
}

export const query = graphql`
  query {
    statesGeoData: file(relativePath: { eq: "data/states.geojson" }) {
      childGeoJson {
        features {
          geometry {
            type
            coordinates
          }
          properties {
            abbreviation
          }
          type
        }
      }
    }
  }
`;
