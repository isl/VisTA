/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import { Rdf } from 'platform/api/rdf';
//import { graph, iri, triple, literal, Iri } from 'platform/api/services/rdf-graph-store';

//import { rdfs, rdf, ldp } from '../../common/ts/rdf/vocabularies/vocabularies';

import { labelRelation, prefices, alignedGraphNS, infoRelations, preferredLangs, } from './AligmentTool';
import { typeRelation, typesRootQuery } from './AligmentTool';
import { exactMatchAlignmentRelation, closeMatchAlignmentRelation, relatedMatchAlignmentRelation, broadMatchAlignmentRelation, broaderAlignmentRelation, equalityRelation } from './AligmentTool';//ADD-RELATION

export const AligmentRdfLink = () => { return Rdf.fullIri("<" + alignedGraphNS + "isAlignedTo>") };
export const AligmentLockedByRdfLink = () => { return Rdf.fullIri("<" + alignedGraphNS + "isLockedBy>") };
export const AligmentCreatedByRdfLink = () => { return Rdf.fullIri("<http://purl.org/dc/terms/creator>") }; //{ return Rdf.fullIri("<" + alignedGraphNS + "isCreatedBy>") };
export const AligmentCreatedOnRdfLink = () => { return Rdf.fullIri("<http://purl.org/dc/terms/created>") };
export const AligmentModifiedOnRdfLink = () => { return Rdf.fullIri("<http://purl.org/dc/terms/modified>") };

export const AligmentDefaultNG = (source: Rdf.Iri, target: Rdf.Iri): { iri: Rdf.Iri, timestamp: string } => {
    const timeStamp = new Date().toISOString();
    const sourceName: string = Rdf.fullIri(source.toString()).value.split("/").pop();;
    const targetName: string = Rdf.fullIri(target.toString()).value.split("/").pop();;
    const newIri = "<" + alignedGraphNS + sourceName + "_" + targetName + "_" + timeStamp + ">";
    return { iri: Rdf.fullIri(newIri), timestamp: timeStamp };
}
export const getExactMatchAlignmentRelation = () => exactMatchAlignmentRelation;
export const getCloseMatchAlignmentRelation = () => closeMatchAlignmentRelation;
export const getRelatedMatchAlignmentRelationn = () => relatedMatchAlignmentRelation;
export const getBroadMatchAlignmentRelation = () => broadMatchAlignmentRelation
export const getBroaderAlignmentRelation = () => broaderAlignmentRelation
//ADD-RELATION

/*
Blazegraph issue
When a pattern {<subject-uri> <property-uri> []} exists and <property-uri> is a transitive property, then Blazegraph returns that the next graph exists:
<subject-uri> <property-uri>+(or *) <dummy:use-any-dummy-uri>  => (impossible!!!)

Workaround
replace triple:
                <subject-uri> <property-uri>+ <tmp-object-uri> .
with:
                <subject-uri> <property-uri> <tmp-object-uri> .
                <tmp-object-uri> <property-uri>* <object-uri> .
*/

export namespace queriesTemplates {

    //ALL DEPTH HIERARCHY LEVEL. Select: ?item ?child //Checked: path-operator * is required
    export function selectTermsHierarchy(ng: Rdf.Iri, terms: Rdf.Iri | string, parentshipRelation: string): string {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT DISTINCT ?item ?child
        FROM ${ng}
        WHERE {#selectTermsHierarchy
        VALUES ?parents { ${terms} }
        #For any direct or indirect item (child) of parent ...
        {?item (${parentshipRelation})* ?parents.}
        #... find all its direct children
        OPTIONAL{?child ${parentshipRelation} ?item.}
        }`;
    }

    //ALL parent hierarchy of a term Select: ?parent
    export function selectParentHierarchy(ngList: Rdf.Iri[], terms: Rdf.Iri[] | string[], parentshipRelation: string): string {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";

        //build 'from' section
        let fromNGStr = "";
        if (ngList) {
            ngList.forEach((ng, i) => {
                fromNGStr += `FROM ${ng}\n`;
            });
        }

        return `${prefices}
        SELECT DISTINCT ?parent ?child
        ${fromNGStr}
        WHERE {#selectParentHierarchy
        VALUES ?child { ${terms.join(" ")} }
        #For any direct or indirect item (child) of parent ...
        {
        ?child (${parentshipRelation})+ ?parentX. 
        ?parentX  ${exactMatchAlignmentRelation.iri}+ ?parentΥ.
        ?parentΥ (${parentshipRelation})+ ?parent.
        } UNION {
        ?child (${parentshipRelation})+ ?parent. 
        } UNION {
        ?child (${exactMatchAlignmentRelation.iri})+ ?parentX. 
        ?parentX (${parentshipRelation})+ ?parent.
        }
        }`;
    }

    //ALL parent hierarchy of a term Select: ?parent
    export function selectDirectParents(ngList: Rdf.Iri[], term: Rdf.Iri, parentshipRelation: string): string {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";

        //build 'from' section
        let fromNGStr = "";
        if (ngList) {
            ngList.forEach((ng, i) => {
                fromNGStr += `FROM ${ng}\n`;
            });
        }

        return `${prefices}
        SELECT DISTINCT ?parent ?child ?parentLabel
        ${fromNGStr}
        WHERE {#selectParentHierarchy
        VALUES ?child { ${term} }
        #For any direct or indirect item (child) of parent ...
        OPTIONAL {?child ${parentshipRelation} ?parent.
        OPTIONAL {?parent ${labelRelation} ?parentLabel.}
        }
        }`;
    }

    //version 2: it looks for the labels into a specified graph list: ngLabelList
    export function selectDirectParents2(ngList: Rdf.Iri[], term: Rdf.Iri, parentshipRelation: string, ngLabelList?: Rdf.Iri[]): string {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";

        //build 'from' section
        let fromNGStr = "";
        if (ngList) {
            ngList.forEach((ng, i) => {
                fromNGStr += `FROM ${ng}\n`;
            });
        }

        const labelStructureStr = (label_sparql_pattern) => {
            let fromLabelNGStr = "";
            if (ngLabelList) {
                ngLabelList.forEach((ng, i) => {
                    fromLabelNGStr += `OPTIONAL { GRAPH ${ng} {${label_sparql_pattern}}}`;
                    if (i < ngLabelList.length - 1) fromLabelNGStr += "\n"
                });
            }
            return fromLabelNGStr;
        }

        return `${prefices}
        SELECT DISTINCT ?parent ?child ?parentLabel
        ${fromNGStr}
        WHERE {#selectParentHierarchy
        VALUES ?child { ${term} }
        #For any direct or indirect item (child) of parent ...
        OPTIONAL {?child ${parentshipRelation} ?parent.
        ${labelStructureStr("?parent " + labelRelation + " ?parentLabel.")}
        }
        }`;
    }

    export function selectHierarchyOptions(ng: Rdf.Iri, ...options: string[]): string {
        let optionSparql = "";
        options.forEach((opt, m) => {
            optionSparql += "\n" + (m > 0 ? "UNION" : "") + `{?concept1 ${opt} ?concept2. BIND(str("${opt}") as ?option)}`
        });
        return `${prefices}
        SELECT ?option (count(*) as ?count)
        FROM ${ng}
        WHERE {
        #selectHierarchyOptions
        ${optionSparql} 
        } GROUP BY ?option ?count
        ORDER BY DESC(?count)
        `;
    }

    //TOP TERMs //NOT USED
    export function selectTopParents(alignmentNG: Rdf.Iri, ng: Rdf.Iri, terms: Rdf.Iri[] | string[], parentshipRelation: string): string {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT DISTINCT ?parent
            FROM ${ng}
        WHERE {
        #selectTopParents
            VALUES ?child { ${terms.join(" ")} }
            #For any direct or indirect item(child) of parent ...
            {?child (${parentshipRelation})+ ?parent.}
            GRAPH ${alignmentNG} {?child ?x ?y}
        }`;
    }

    //Non aligned children of a source term. Selects: ?child
    export function selectDirectNonAlignedChildren(alignmentNG: Rdf.Iri, sourceTerm: Rdf.Iri, targetNG: Rdf.Iri): string {
        return `${prefices}
        SELECT DISTINCT ?child
            FROM ${alignmentNG}
        WHERE {
        #selectTermsChildren
            VALUES ?item { ${sourceTerm} }
            #...find all its direct children
                ?child ${broaderAlignmentRelation.iri} ?item.

            MINUS{
                ?child ?relation ?targetTerm . 
                GRAPH ${targetNG} { ?targetTerm a skos:Concept }
            }
        
        }`;
    }
    // MINUS{
    //     ?child ?relation ?targetTerm . 
    //     GRAPH ${targetNG} {
    //         { ?targetTerm ?x ?y }
    //         UNION
    //         { ?x ?y ?targetTerm }
    //     }
    // }

    export function deleteTripleInNG(ng: Rdf.Iri, s: Rdf.Iri, p: Rdf.Iri, o: Rdf.Iri) {
        return `${prefices}
        DELETE DATA {
        #deleteTripleInNG
            GRAPH ${ng} { ${s} ${p} ${o} }
        }`;
    }

    export function deleteTriplesInNG(ng: Rdf.Iri, ntriples: string) {
        return `${prefices}
        DELETE DATA {
        #deleteTriplesInNG
            GRAPH ${ng} { ${ntriples} }
        }`;
    }

    export function deleteWhereSubjectInNG(ng: Rdf.Iri, s: Rdf.Iri, p: Rdf.Iri) {
        return `${prefices}
        WITH ${ng} #deleteWhereSubjectInNG
        DELETE { ${s} ${p} ?o }
        WHERE  { ${s} ${p} ?o }
        `;
    }

    export function deleteTermsFromNG(ng: Rdf.Iri, termList: Rdf.Iri[]) {
        const terms = termList ? termList.join(" ") : "<http://dummy>";
        return `${prefices}
        WITH ${ng} #deleteTermsFromNG
        DELETE { ?s ?p ?o }
        WHERE  {
            VALUES ?term {${terms}}
            {?term ?p ?o. Bind (?term as ?s)}
            UNION
            {?s ?p ?term. Bind (?term as ?o)}
        }
        `;
    }

    export function updateGraphLabel(ng: Rdf.Iri, label: string) {
        const INSERT = label ? `INSERT { ${ng} rdfs:label "${label}" }` : "";
        return `${prefices}
        WITH ${ng} #updateGraphLabel
        DELETE { ${ng} rdfs:label ?label }
        ${INSERT}
        WHERE  { ?s ?p ?o. OPTIONAL{ ${ng} rdfs:label ?label } }
        `;

    }

    export function insertTriplesInNG(ng: Rdf.Iri, ntriples: string) {
        return `${prefices}
        INSERT DATA {
        #insertTriplesInNG
            GRAPH ${ng} { ${ntriples} }
        }`;
    }

    export function insertTripleInNG(ng: Rdf.Iri, s: Rdf.Iri, p: Rdf.Iri, o: Rdf.Iri) {
        return `${prefices}
        INSERT DATA {
        #insertTripleInNG
            GRAPH ${ng} { ${s} ${p} ${o} }
        }`;
    }

    //new not used
    //Non-aligned indirect children of a source term. Delete triples:  ?child ?relation ?item
    export function deleteNonAlignedChildrenOfSourceTerm(alignmentNG: Rdf.Iri, sourceTerm: Rdf.Iri, targetNG: Rdf.Iri): string {
        return `${prefices}
        WITH ${alignmentNG}
        DELETE { ?child ?relation ?item }
        WHERE {
            SELECT DISTINCT ?child
                FROM ${alignmentNG}
            WHERE {
            #selectTermsChildren
                VALUES ?item { ${sourceTerm} }
                #...find all its direct children
                    ?child ${broaderAlignmentRelation.iri} ?item.

                    MINUS {?child ?relation ?item.
                        ?item (${broaderAlignmentRelation.iri})* ?sourceTermX.
                        ?sourceTermX (${exactMatchAlignmentRelation.iri} | ${broadMatchAlignmentRelation.iri}) ?targetTerm2.
                        GRAPH ${targetNG} {?targetTerm2 ?p ?o.}
                        FILTER( ?sourceTermX != ${sourceTerm} )
            
            }`;
    }

    //TBChecked//Just try to handle the direct parentship. No need to perform a deep cleaning at this moment, to improve performance. So don't use (${parentshipRelation})*
    //Case: the sourceTerm has to be deleted. Thus the relation with its parent will be removed. But why the relation to its direct children has to be removed?
    export function deleteExclusiveTermAlignedChildren(alignmentNG, sourceNG, targetNG, sourceTerm, targetTerm, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        WITH ${alignmentNG}
        DELETE { ?child ?relation ?item }
        WHERE {
        #deleteExclusiveTermAlignedChildren
            ?child ?relation ?item.
                ?item (${parentshipRelation}) ?tmp.
                    FILTER(?tmp = ${sourceTerm})
                GRAPH ${sourceNG} { ?child ?x ?y }.

            #...exclude those that belong to other alignments
            MINUS {?child ?relation ?item.
                ?item (${parentshipRelation}) ?sourceTerm2.
                ?sourceTerm2 (${exactMatchAlignmentRelation.iri} | ${broadMatchAlignmentRelation.iri}) ?targetTerm2.
                GRAPH ${targetNG} {?targetTerm2 ?p ?o.}
                FILTER( ?sourceTerm2 != ${sourceTerm} || ?targetTerm2 != ${targetTerm})
            }
        }`;
    }

    //VERY GOOD PERFORMANCE WHEN USED RECURSIVELY
    export function selectNonAlignedTermsFromAlignmentGraph(alignmentNG, sourceNG, targetNG, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT ?orphanTerm ?child ?deleteChild 
        FROM ${alignmentNG}
        WHERE {
        #selectNonAlignedTermsFromAlignmentGraph
            ?child ${parentshipRelation} ?orphanTerm.
            OPTIONAL{?orphanTerm ?rel ?tmpTerm.}
            FILTER(!BOUND(?tmpTerm))
            OPTIONAL{?moreChildren ${parentshipRelation} ?child.}
            MINUS{?child ${parentshipRelation} ?moreParents.
                FILTER(?moreParents != ?orphanTerm)
            }
            BIND (!BOUND(?moreChildren) && !BOUND(?moreParents) as ?deleteChild)
        } LIMIT 200`;
    }

    export function selectNonAlignedTermsFromAlignmentGraph_WRONG(alignmentNG, sourceNG, targetNG, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT ?orphanTerm ?child 
        FROM ${alignmentNG}
        WHERE {
        #selectNonAlignedTermsFromAlignmentGraph
            ?child ${parentshipRelation} ?orphanTerm.
            OPTIONAL{?orphanTerm ${parentshipRelation} ?tmpTerm. #removed *
                ?tmpTerm ?isAlignedTo ?alignedTargetTerm .
                GRAPH ${targetNG} { {?alignedTargetTerm ?s []} UNION {[] ?t ?alignedTargetTerm} }
            }
            FILTER(!BOUND(?tmpTerm))
        } LIMIT 200`;
    }

    //NEW TODO //closeMatchAlignmentRelation
    export function selectAlignedTermsBySuperSourceTerm(alignmentNG, sourceNG, superSourceTerm, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT ?sTerm ?sLabel ?rel ?tTerm ?tLabel
        WHERE {
        #selectAlignedTermsBySuperSourceTerm

        #Get all the children of superterm
        GRAPH ${sourceNG} {
            ?sTerm (${parentshipRelation})* ${superSourceTerm} .
        }

        VALUES ?rel {${exactMatchAlignmentRelation.iri} ${broadMatchAlignmentRelation.iri} }
        #Get also the superterm
        OPTIONAL {
            GRAPH ${alignmentNG} { 
                ${superSourceTerm} ?rel ?tTerm. 
                BIND ( ${superSourceTerm} as ?sTerm ) 
            }
        }
         
        GRAPH ${alignmentNG} { ?sTerm ?rel ?tTerm. }

        OPTIONAL { ?sTerm ${labelRelation} ?sLabelX. } 
        BIND ( IF(CONTAINS(STR(?sLabelX),"unauthorised"), STR(?sTerm) , STR(?sLabelX)) as ?sLabel ) 

        OPTIONAL { ?tTerm ${labelRelation} ?tLabelX. } 
        BIND ( IF(CONTAINS(STR(?tLabelX),"unauthorised"), STR(?tTerm) , STR(?tLabelX)) as ?tLabel ) 
        }`;
    }

    export function selectTermDirectChildrenAtGraph(NG, labelNG, term, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT DISTINCT ?child ?label
            FROM ${NG}
        WHERE {
        #selectSourceTermDirectChildrenAtGraph
            ?child ${parentshipRelation} ${term} .
            GRAPH ${labelNG} { ?child ?x ?y.
                OPTIONAL{ ?child ${labelRelation} ?label }
            }
        }`;
    }

    export function selectTermAlignedParents(alignmentNG, sourceNG, term, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT DISTINCT ?parent
            FROM ${alignmentNG}
        WHERE {
        #selectTermAlignedParents
            ${term} (${parentshipRelation})* ?parent.
                GRAPH ${sourceNG} { ?parent ?x ?y } .
        }`;
    }

    export function selectAlignmentTriples(ng: Rdf.Iri, bindVarS: string, bindVarR: string, bindVarT: string) {
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();
        const createdByLink = AligmentCreatedByRdfLink();
        const createdOnLink = AligmentCreatedOnRdfLink();
        const modifiedOnLink = AligmentModifiedOnRdfLink();
        return `${prefices}
        SELECT ?${bindVarS} ?${bindVarR} ?${bindVarT}
        FROM ${ng}
        WHERE {
        #selectAlignmentTriples
            ?${bindVarS} ?${bindVarR} ?${bindVarT} .
            FILTER(?${bindVarR} NOT IN (${alignmentLink}, ${isLockedByLink}, ${createdByLink}, ${createdOnLink}, ${modifiedOnLink}) )
        }`;
    }

    export function selectTermLabel(term: Rdf.Iri, labelNG?: Rdf.Iri) {
        const from_clause = labelNG ? `FROM ${labelNG}` : "";
        return `${prefices}
        SELECT DISTINCT (STR(?labelX) as ?label)
        ${from_clause}
        WHERE {
        #selectTermLabel
            ${term} ${labelRelation} ?labelX.
        }`;
    }

    export function askTripleExistsInNG(ng: Rdf.Iri, s: Rdf.Iri | string, p: Rdf.Iri | string, o: Rdf.Iri | string) {
        return `${prefices}
        ASK
        FROM ${ng} {
        #askTripleExistsInNG
            GRAPH ${ng} { ${s} ${p} ${o} }
        }`;
    }

    export function askSubjectFromNG(ng: Rdf.Iri, s: Rdf.Iri) {
        return `${prefices}
        ASK
        FROM ${ng} {
        #askSubjectFromNG
            ${s} ?p ?o.
        }`;
    }

    export function askTermInNG(ng: Rdf.Iri, term: Rdf.Iri) {
        return `${prefices}
        ASK
        FROM ${ng} {
        #askSubjectFromNG
            {${term} ?p ?o} UNION {?s ?p ${term}}
        }`;
    }
    //NOT USED
    export function askSourceTermHasAlignedDescendants(sourceTerm: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, parentshipRelation: string, targetNG?: Rdf.Iri) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        const explicitlyAligned = (targetNG ? `GRAPH ${targetNG} {?o ?x ?y} ` : "");
        return `${prefices}
        ASK
        FROM ${alignmentNG} {
        #askSourceTermHasAlignedDescendants
            ?s ?p ?o.
                ${explicitlyAligned}
            GRAPH ${sourceNG} {?s (${parentshipRelation}) + ?tmp.
                FILTER(?tmp = ${sourceTerm}) 
                }
        }`;
    }

    //NOT USED
    export function askTargetTermHasAlignedDescendants(targetTerm: Rdf.Iri, alignmentNG: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        ASK
        FROM ${alignmentNG} {
        #askTargetTermHasAlignedDescendants
            ?s ?p ?o. 
                GRAPH ${targetNG} {?o (${parentshipRelation}) + ?tmp.
                FILTER(?tmp = ${targetTerm})
        }`;
    }

    //TBChecked: DONE/OK //Works ok because of no property-path-operators
    export function askSourceTargetRelatedDirectly(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, relation: Rdf.Iri, alignmentNG: Rdf.Iri, targetNG: Rdf.Iri) {
        return `${prefices}
        ASK
        FROM ${alignmentNG}
        FROM ${targetNG} {
        #askSourceTargetRelatedDirectly#
            VALUES ?x { ${sourceTerm} }
            ?x ${relation} ${targetTerm} .
        }`;
    }

    //TBChecked: DONE/OK
    export function askSourceExistsInTargetHierarchy(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        ASK
        FROM ${targetNG} {
        #askSourceExistsInTargetHierarchy#
            VALUES ?x { ${sourceTerm} }
            {   ?x ${exactMatchAlignmentRelation.iri} + ?tmpExact 
                FILTER(?tmpExact = ${targetTerm})
            }
            UNION
            {   ?tmpExact ${exactMatchAlignmentRelation.iri} + ?x 
                FILTER(?tmpExact = ${targetTerm})
            }
            UNION
            {   ?x (${parentshipRelation}) + ?tmpParent.
                FILTER(?tmpParent = ${targetTerm})
            }
            UNION
            {   ?tmpChild (${parentshipRelation}) + ?x.
                FILTER(?tmpChild = ${targetTerm})
            }
        }`;
    }

    //TBChecked: DONE/OK
    export function selectSourceIndirectRelatedToTarget(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, parentshipRelation: string, targetNG?: Rdf.Iri) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        const fromTarget = targetNG ? `FROM ${targetNG} ` : "";
        const optionalTargetLabel = targetNG ? `OPTIONAL { GRAPH ${targetNG} { ?relTerm  ${labelRelation} ?relTermLabel. } } ` : ``;
        const optionalSourceLabel = `OPTIONAL { GRAPH ${sourceNG} { ?relTerm  ${labelRelation} ?relTermLabel. } }`;
        return `${prefices}
        SELECT ?relCase (str(?relTermLabel) as ?relCaseTerm)
        ${fromTarget}
        FROM ${alignmentNG} {
        #selectSourceIndirectRelatedToTarget
            VALUES ?x { ${sourceTerm} }
            {
                ?x (${parentshipRelation}) + ?relTerm.
                ?relTerm ${exactMatchAlignmentRelation.iri} + ?tmp.
                    FILTER(?tmp = ${targetTerm})
                ${optionalSourceLabel}
                ${optionalTargetLabel}
                BIND(IF(BOUND(?relTermLabel), ?relTermLabel, ?relTerm) as ?relTermLabel)
                BIND("a narrow-match of the exact-match term" as ?relCase)
            }
            UNION {
                ?x ${exactMatchAlignmentRelation.iri} + ?tmp.
                    FILTER(?tmp = ${targetTerm})
                BIND("exact-match of the term" as ?relCase)
            }
            UNION {
                ?x (${parentshipRelation}) + ?relTerm.
                ?relTerm (${parentshipRelation}) + ?tmp.
                        FILTER(?tmp = ${targetTerm})
                ${optionalSourceLabel}
                ${optionalTargetLabel}
                BIND(IF(BOUND(?relTermLabel), ?relTermLabel, ?relTerm) as ?relTermLabel)
                BIND("a narrow-match of term" as ?relCase)
            }
            UNION {
            #NEW
                ?x (${exactMatchAlignmentRelation.iri} |^ ${exactMatchAlignmentRelation.iri}) + ?relTerm.
                ?relTerm (${parentshipRelation}) + ?tmp.
                        FILTER(?tmp = ${targetTerm})
                ${optionalSourceLabel}
                ${optionalTargetLabel}
                BIND(IF(BOUND(?relTermLabel), ?relTermLabel, ?relTerm) as ?relTermLabel)
                BIND("an exactTerm of the narrow-match of" as ?relCase)
            }
            UNION {
                ?x ${broadMatchAlignmentRelation.iri} + ?tmp.
                    FILTER(?tmp = ${targetTerm})
                BIND("narrow-match of the term" as ?relCase)
            }
        } LIMIT 1`;
    }

    export function askIsLockedByOtherUser(alignmentNG: Rdf.Iri, user: Rdf.Iri): string {
        const isLockedByLink = AligmentLockedByRdfLink();
        return `${prefices}
        ASK
        FROM ${alignmentNG} {
        #askIsLockedByOtherUser
            ${alignmentNG} ${isLockedByLink} ?user.
                FILTER( ?user != ${user})
        }`;
    }

    //new
    export function askIsRemovableNode(alignmentNG: Rdf.Iri, sourceTerm: Rdf.Iri, relation: Rdf.Iri, targetTerm: Rdf.Iri) {
        return `${prefices}
        ASK
        FROM ${alignmentNG} {
        #askIsRemovableNode
        ${sourceTerm} ${relation} ${targetTerm} .
        OPTIONAL{${sourceTerm} (${broadMatchAlignmentRelation.iri}) ?otherTargetTerm . 
        ${targetTerm} (${exactMatchAlignmentRelation.iri}) ?otherTargetTerm .}
        FILTER(!BOUND(?otherTargetTerm))
        }`;
    }

    //TBChecked: DONE/OK
    /*Query returns how many times a term is implicitly/explicitly aligned*/
    /*Result includes the sourceTerm as well*/
    export function selectAlignmentMultiplicityOfSourceTerm____OLD(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, sourceTerm: Rdf.Iri) {
        return `${prefices}
        SELECT ?child(?count2 as ?alignmentMultiplicity)
        FROM ${alignmentNG}
        WHERE {
        #selectAlignmentMultiplicityOfSourceTerm

            {
                SELECT ?child(COUNT(?count) as ?count2) {
                #3
                    {
                        SELECT ?child(COUNT(?child) as ?count){
                        #2
                            {
                                SELECT DISTINCT ?child ?sourceTerm2 ?targetTerm2 {
                                #1
                                    ?child ${broaderAlignmentRelation.iri} ?tmp.
                                        FILTER(?tmp = ${sourceTerm})
                GRAPH ${sourceNG} { ?child ?x ?y } .
                GRAPH ${targetNG} { ?targetTerm2 ?p ?o. } 
                ?child ${broaderAlignmentRelation.iri}* ?sourceTerm2.

                    #...find those that belong to other alignments
                    {
                    ?sourceTerm2 ${exactMatchAlignmentRelation.iri} ?targetTerm2.  
                    }
                    UNION{
                    ?sourceTerm2 ${closeMatchAlignmentRelation.iri} ?targetTerm2.  
                    }                    
                    UNION{
                    ?sourceTerm2 ${relatedMatchAlignmentRelation.iri} ?targetTerm2.  
                    }
                    UNION {
                    ?sourceTerm2 ${broadMatchAlignmentRelation.iri} ?targetTerm2.    
                    }
                                    #MINUS { GRAPH ${targetNG} { ?sourceTerm2 ${exactMatchAlignmentRelation.iri} ?targetTerm2. } } #case of common terms at both trees
                                    #MINUS { GRAPH ${targetNG} { ?sourceTerm2 ${broadMatchAlignmentRelation.iri} ?targetTerm2.} } #case of common terms at both trees
                                }
                            } #SELECT 1
                        } GROUP BY ?child ?sourceTerm2 ?targetTerm2 } #SELECT 2
                } GROUP BY ?child } #SELECT 3

            #FILTER(?count2 <= 3)
        }`;
    }
    //NEW TODO
    export function selectAlignmentMultiplicityOfSourceTerm(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, sourceTerm: Rdf.Iri) {
        return `${prefices}
        SELECT (COUNT(*) as ?alignmentMultiplicity)
        FROM ${alignmentNG}
        WHERE {
        #selectAlignmentMultiplicityOfSourceTerm

        { SELECT DISTINCT ?foundRelation ?linkedTerm {
            {
                ${sourceTerm} ?directRelation ?targetTerm .#check explicit alignments
                GRAPH ${targetNG} { ?targetTerm ?p ?o . }
                FILTER( ?directRelation in (${exactMatchAlignmentRelation.iri}, ${closeMatchAlignmentRelation.iri}, ${relatedMatchAlignmentRelation.iri}, ${broadMatchAlignmentRelation.iri}) )
                BIND( ?directRelation as ?foundRelation)
                BIND( ?targetTerm as ?linkedTerm)
            }
            UNION {
                ${sourceTerm} ${broaderAlignmentRelation.iri}+ ?parentSourceTerm . #check implicit alignments through ?parentSourceTerm
                ?parentSourceTerm  (${exactMatchAlignmentRelation.iri}+|${broadMatchAlignmentRelation.iri}) ?targetTerm .
                GRAPH ${sourceNG} { ?parentSourceTerm ?p1 ?o1 . }
                GRAPH ${targetNG} { ?targetTerm ?p2 ?o2 . }
                FILTER(?parentSourceTerm != ${sourceTerm} )
                BIND( ${broaderAlignmentRelation.iri} as ?foundRelation)
                BIND( ?parentSourceTerm as ?linkedTerm)
            }   
        }}              
        }`;
    }

    //old
    export function selectRemovableDirectChildren(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri) {
        return `${prefices}
        SELECT DISTINCT ?child 
        FROM ${alignmentNG}
        WHERE {
        #selectRemovableDirectChildren

            ?child ${broaderAlignmentRelation.iri}? ${sourceTerm} .#get direct children or the(to - be - deleted) sourceTerm
            MINUS{
                {
                #CASE1: DELETE BROADER - MATCH TERM OR CHILD
                    ?child ${broadMatchAlignmentRelation.iri}? ${targetTerm} .#explicitly aligned term or child
                    { ?child ${broaderAlignmentRelation.iri}  ?sourceTerm1 .#implicitly aligned term
                        ?sourceTerm1 ${exactMatchAlignmentRelation.iri} ${targetTerm} .
                        GRAPH ${sourceNG} { ?sourceTerm1 ?x1 ?y1 } .
                    }
                }
                UNION
                {
                #CASE2: DELETE CHILD OF DIFFERENT EXACT - MATCH TERMS
                    ${sourceTerm} ${exactMatchAlignmentRelation.iri} ${targetTerm} .#explicitly aligned term
                    { ?sourceTerm2 ${exactMatchAlignmentRelation.iri} ${targetTerm} .#explicitly aligned term
                        ?child ${broaderAlignmentRelation.iri}  ?sourceTerm2. #child explicitly aligned term
                        GRAPH ${sourceNG} { ?sourceTerm2 ?x2 ?y2 } .
                        FILTER(?sourceTerm2 != ${sourceTerm})
                    }
                }
            }
        }`;
    }

    //new
    export function selectParentsOfRemovableAlignedTermDEL(alignmentNG: Rdf.Iri, removableTerm: Rdf.Iri) {
        return `${prefices}
        SELECT DISTINCT ?parent 
        FROM ${alignmentNG}
        WHERE {
        #selectParentsOfRemovableTerm
        {${removableTerm} ${broaderAlignmentRelation.iri} ?parent .}
            UNION
            {${removableTerm} }
            ${removableTerm} (${broaderAlignmentRelation.iri}|${broadMatchAlignmentRelation.iri}|${exactMatchAlignmentRelation.iri})  ?parent .
        }`;
    }

    export function selectTargetAlignments(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, bindVarS: string, bindVarR: string, bindVarT: string, bindVarL: string, bindVarTargetLabel: string) {
        return `${prefices}
        SELECT DISTINCT ?${bindVarS} ?${bindVarR} ?${bindVarT} ?${bindVarL} ?${bindVarTargetLabel}
        WHERE {
        #selectTargetAlignments
            GRAPH ${alignmentNG} { ?${bindVarS} ?${bindVarR} ?${bindVarT} }
            FILTER (?${bindVarT} != ${targetNG})
            GRAPH ${targetNG} { ?${bindVarT} ?x ?y }
            OPTIONAL { GRAPH ${targetNG} { ?${bindVarT} ${labelRelation}  ?${bindVarTargetLabel} } }
            OPTIONAL { GRAPH ${sourceNG} { ?${bindVarS} ${labelRelation} ?${bindVarL} } }

            ${createFilterPreferredLangsSPARQLSection(bindVarL)}
            ${createFilterPreferredLangsSPARQLSection(bindVarTargetLabel)}

        }`;
    }

    /*
        //This is the preferred solution
        ${createFilterPreferredLangsSPARQLSection(bindVarL)}
        ${createFilterPreferredLangsSPARQLSection(bindVarTargetLabel)}
     
        //This solution is an optimal automatic one but results in query time expiration
        ${createPreferredLangsSPARQLSection(sourceNG, bindVarS, bindVarL, "itemY", "labelY", "prefLangY", "anyLangY", "allLangY")}
        ${createPreferredLangsSPARQLSection(undefined, bindVarT, bindVarTargetLabel, "itemZ", "labelZ", "prefLangZ", "anyLangZ", "allLangZ")} 
     
        ${createPreferredLangsSPARQLSection2(sourceNG, bindVarS, bindVarL, "itemY", "labelY")}
        ${createPreferredLangsSPARQLSection2(undefined, bindVarT, bindVarTargetLabel, "itemZ", "labelZ")}
     */

    export function createFilterPreferredLangsSPARQLSection(bindVarL: string) {
        if (!preferredLangs || preferredLangs.length == 0) return "";
        const langINList = preferredLangs.map(item => `"${item}"`).join(",");
        return `FILTER(!BOUND(?${bindVarL}) || (BOUND(?${bindVarL}) && (LANG(?${bindVarL}) IN (${langINList})) ) ) `;
    }


    /* This function produces a sparql subquery for retrieving automatically the preferred language. 
    bindVarS, bindVarL: are related to the requested entity in the basic query
    bindVarS2, bindVarL2: are the corresponding entities used in the subquery
    */
    export function createPreferredLangsSPARQLSection(sourceNG: Rdf.Iri, bindVarS: string, bindVarL: string, bindVarS2: string, bindVarL2: string, bindVarPrefLang?: string, bindVarAnyLang?: string, bindVarAllLangs?: string) {
        if (!preferredLangs || preferredLangs.length == 0) return "";

        const prefLang = bindVarPrefLang ? bindVarPrefLang : "prefLang";
        const anyLang = bindVarAnyLang ? bindVarAnyLang : "anyLang";
        const allLangs = bindVarAllLangs ? bindVarAllLangs : "allLang";
        let langStr = "";

        preferredLangs.forEach(lang =>
            langStr += "\n" + `BIND(IF(!BOUND(?${prefLang}) && CONTAINS( ?${allLangs}, '${lang}'), '${lang}', 1 / 0) as ?${prefLang}).`
        );

        return `
        {
            SELECT ?${bindVarS2} (SAMPLE(DISTINCT ?lang) AS ?${anyLang}) (GROUP_CONCAT(DISTINCT ?lang; SEPARATOR = " ") AS ?${allLangs})
            WHERE {

                {
                    SELECT DISTINCT ?${bindVarS2} ?lang
                    WHERE {
                        BIND(LANG(?${bindVarL2}) AS ?lang)
                        ${
            (sourceNG) ?
                //case 1
                `{
                SELECT DISTINCT ?${bindVarS2} ?${bindVarL2} {
                GRAPH  ${sourceNG}  { ?${bindVarS2} ${labelRelation} ?${bindVarL2} } . 
                    }
                } UNION {
                ?${bindVarS2} ${labelRelation} ?${bindVarL2} . 
                } 
                BIND(LANG(?${bindVarL2}) AS ?lang).`
                :
                //case 2
                `?${bindVarS2} ${labelRelation} ?${bindVarL2} .`
            }
                    }
                }
            } GROUP BY ?${bindVarS2}
        }

        FILTER(?${bindVarS2} = ?${bindVarS})
        ${langStr}
        BIND(IF(BOUND(?${prefLang}), ?${prefLang},?${anyLang}) as ?${prefLang}).
            FILTER(LANGMATCHES(LANG(?${bindVarL}), COALESCE(?${prefLang}, ?${anyLang})))

            `;
    }


    export function createPreferredLangsSPARQLSection2(sourceNG: Rdf.Iri, bindVarS: string, bindVarL: string, bindVarS2: string, bindVarL2: string, bindVarLang2: string) {
        if (!preferredLangs || preferredLangs.length == 0) return "";
        const unionList = preferredLangs.map((item, i) =>
            `\n{?${bindVarS2} ${labelRelation} ?${bindVarL2}.
            FILTER(LANG(?${bindVarL2}) = "${item}")
            BIND("${item}" as ?lang${i})
        } `).join("\nUNION\n");

        //const sampleList = preferredLangs.map((item, i) => `SAMPLE(?lang${i }) `).join(",");
        let sampleList = preferredLangs.map((item, i) => `?lang${i} `).join(",");
        //sampleList += ", 1/0"; //No specific lang case
        const bindCoalesceLang = `BIND(COALESCE (${sampleList}) as ?${bindVarLang2}) `;
        return `
        {
            SELECT DISTINCT ?${bindVarS2}  ?${bindVarLang2} {
                ${
            (sourceNG) ?
                //case 1
                `GRAPH ${sourceNG}{ ${unionList} }
                } UNION { ${unionList} }`
                :
                //case 2
                `{ ${unionList} }`
            }
                ${bindCoalesceLang}
            } GROUP BY ?${bindVarS2} ?${bindVarLang2}
        }
        FILTER(IF(BOUND(?${bindVarLang2}), ((?${bindVarS} = ?${bindVarS2}) && (LANG(?${bindVarL}) = ?${bindVarLang2})), true))
        `;
    }

    export function createPreferredLangsSPARQLSection2_OLD(sourceNG: Rdf.Iri, bindVarS: string, bindVarL: string, bindVarS2: string, bindVarL2: string) {
        if (!preferredLangs || preferredLangs.length == 0) return "";
        const unionList = preferredLangs.map((item, i) =>
            `\n{?${bindVarS2} ${labelRelation} ?${bindVarL2}.
            BIND(IF(LANG(?${bindVarL2}) = "${item}", "${item}", 1 / 0) as ?lang${i})
        } `).join("\nUNION\n");

        const sampleList = preferredLangs.map((item, i) => `SAMPLE(?lang${i}) `).join(",");
        const coalesce = `(COALESCE (${sampleList}) as ?lang) `;

        return `
        {
            SELECT DISTINCT ?${bindVarS2} ${coalesce} {
                BIND(LANG(?${bindVarL2}) as ?lang)
                ${(sourceNG ? `GRAPH ${sourceNG}{` : "")}
                ${unionList}
                ${(sourceNG ? `}` : "")}
            } GROUP BY ?${bindVarS2}
        }
        FILTER(LANG(?${bindVarL}) = ?lang )
        FILTER( ?${bindVarS} = ?${bindVarS2})
            `;
    }
    export function selectSourceAlignments(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, bindVarS: string) {
        return `${prefices}
        SELECT DISTINCT ?${bindVarS}
        WHERE {
        #selectSourceAlignments
            GRAPH ${alignmentNG} { ?${bindVarS} ?r ?t }
            FILTER (?${bindVarS} != ${sourceNG})
            GRAPH ${sourceNG} {
                { ?${bindVarS} ?x ?y }
                UNION {
                    { ?${bindVarS} ${equalityRelation} ?sameTerm.}
                    UNION
                    { ?sameTerm ${equalityRelation}  ?${bindVarS} .}
                    BIND(?sameTerm as ?${bindVarS})
                }
            }
        }`;
    }

    export function selectTargetTermAlignments(alignmentNG: Rdf.Iri, targetTerm: Rdf.Iri, bindVarS: string, bindVarR: string) {
        return `${prefices}
        SELECT DISTINCT ?${bindVarS} ?${bindVarR}
        FROM ${alignmentNG}
        WHERE {
        #selectTargetTermAlignments
            ?${bindVarS} ?${bindVarR} ${targetTerm}
        }`;
    }

    //ALL DEPTH HIERARCHY LEVEL. Select: ?item ?itemLabel ?hasChildren
    export function selectSourceDescendantsQuery(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, sourceTerm: Rdf.Iri, parentshipRelation: string) {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
        SELECT DISTINCT ?item ?itemLabel ?hasChildren
        #FROM  ${sourceNG}
        #FROM  ${alignmentNG}

        WHERE {
        #selectSourceDescendantsQuery

            #GRAPH ${alignmentNG} {
                VALUES ?parent { ${sourceTerm} }
            ?item ${parentshipRelation} ?parent.
                #
            }

            GRAPH ${sourceNG} {

                OPTIONAL {?child ${parentshipRelation} ?item.}
                BIND(bound(?child) as ?hasChildren)
            }

            OPTIONAL {
            ?item  ${labelRelation} ?itemLabel.
            }
        }`;
    }

    export function selectAdditionalInfo(ngList: Rdf.Iri[], term: Rdf.Iri): string {

        //build 'from' section
        let fromNGStr = "";
        if (ngList) {
            ngList.forEach((ng, i) => {
                fromNGStr += `FROM ${ng}\n`;
            });
        }

        return `${prefices}
        SELECT DISTINCT ?scopeNote ?lang
        ${fromNGStr}
        WHERE {
        #selectAdditionalInfo
            VALUES ?item { ${term} }
             ?item  ${infoRelations} ?scopeNote.
                BIND(lang(?scopeNote) as ?lang)
            FILTER(!isIRI(?scopeNote))
        }`;
    }

    export function selectSchemeGraphs(limit?: number, offset?: number): string {
        const limitStr = limit ? "LIMIT " + limit : "";
        const offsetStr = limit && offset ? "OFFSET " + offset : "";
        return `SELECT DISTINCT ?graph  ?scheme
        WHERE {
            #selectSchemeGraphs
            GRAPH ?graph { ?s <http://www.w3.org/2004/02/skos/core#inScheme> ?scheme.} 
        }
        ${limitStr}
        ${offsetStr}
        `;
    }

    export function selectSchemeByNG(ng: Rdf.Iri): string {
        return `SELECT DISTINCT ?scheme 
        FROM ${ng}
        WHERE {
            #selectSchemeByNG
            ?s <http://www.w3.org/2004/02/skos/core#inScheme> ?scheme. 
        }`;
    }

    export function selectAlignmentGraphs(bindVar: string, limit?: number, offset?: number): string {
        const alignmentLink = AligmentRdfLink();
        const limitStr = limit ? "LIMIT " + limit : "";
        const offsetStr = limit && offset ? "OFFSET " + offset : "";
        return `SELECT DISTINCT ?${bindVar}
            WHERE {
            #selectAlignmentGraphs
                GRAPH ?${bindVar} { ?s  ${alignmentLink} ?o }
            }
            ${limitStr}
            ${offsetStr}
            `;
    }
    //NEW
    export function selectAlignmentGraphsPerUser(bindGraphVar: string, bindGraphLabelVar: string,
        bindSourceVar: string, bindTargetVar: string,
        bindUserVar: string, bindCreatorVar: string,
        bindCreatedOnVar: string, bindModifiedOnVar: string,
        limit?: number, offset?: number): string {
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();
        const isCreatedByLink = AligmentCreatedByRdfLink();
        const isCreatedOnLink = AligmentCreatedOnRdfLink();
        const isModifiedOnLink = AligmentModifiedOnRdfLink();

        const limitStr = limit ? "LIMIT " + limit : "";
        const offsetStr = limit && offset ? "OFFSET " + offset : "";
        return `SELECT DISTINCT ?${bindGraphVar} ?${bindSourceVar} ?${bindTargetVar} ?${bindGraphLabelVar} ?${bindUserVar} ?${bindCreatorVar} ?${bindCreatedOnVar} ?${bindModifiedOnVar}
            WHERE {
            #selectAlignmentGraphs
                GRAPH ?${bindGraphVar} { 
                    ?${bindSourceVar}  ${alignmentLink} ?${bindTargetVar} .
                    OPTIONAL {
                        ?${bindGraphVar} ${isLockedByLink}  ?${bindUserVar} .
                    }
                    OPTIONAL {
                        ?${bindGraphVar} ${isCreatedByLink}  ?${bindCreatorVar} .
                    }
                    OPTIONAL {
                        ?${bindGraphVar} ${isCreatedOnLink}  ?${bindCreatedOnVar} .
                    }
                    OPTIONAL {
                        ?${bindGraphVar} ${isModifiedOnLink}  ?${bindModifiedOnVar} .
                    }
                    OPTIONAL {
                        ?${bindGraphVar} rdfs:label  ?${bindGraphLabelVar} .
                    }
                }
            } order by desc(?${bindCreatedOnVar}) desc(?${bindModifiedOnVar})
            ${limitStr}
            ${offsetStr}
            `;
    }

    export function selectAlignmentGraphsByUser(bindGraphVar: string, user: Rdf.Iri, limit?: number, offset?: number): string {
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();

        const limitStr = limit ? "LIMIT " + limit : "";
        const offsetStr = limit && offset ? "OFFSET " + offset : "";
        return `SELECT DISTINCT ?${bindGraphVar}
            WHERE {
            #selectAlignmentGraphsByUser
                GRAPH ?${bindGraphVar} { 
                    ?s  ${alignmentLink} ?o.
                    ?${bindGraphVar} ${isLockedByLink} ${user} .
                }
            }
            ${limitStr}
            ${offsetStr}
            `;
    }

    export function selectAlignmentGraphsBySourceOrTarget(bindGraphVar: string, NG1: Rdf.Iri, NG2?: Rdf.Iri): string {
        const alignmentLink = AligmentRdfLink();
        const NG3 = NG2 ? NG2 : "?NG2";
        return `SELECT DISTINCT ?${bindGraphVar}
            WHERE {
            #selectAlignmentGraphsByUser
                GRAPH ?${bindGraphVar} { 
                    {${NG1} ${alignmentLink} ${NG3} } UNION {${NG3} ${alignmentLink} ${NG1} }
                }
            }
            `;
    }

    export function selectUnlockedAlignmentGraphs(bindVar: string, limit?: number, offset?: number): string {
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();
        const limitStr = limit ? "LIMIT " + limit : "";
        const offsetStr = limit && offset ? "OFFSET " + offset : "";
        return `SELECT DISTINCT ?${bindVar}
            WHERE {
            #selectUnlockedAlignmentGraphs
                GRAPH ?${bindVar} { ?s  ${alignmentLink} ?o. }
                MINUS { ?${bindVar} ${isLockedByLink} ?user. }
            }
            ${limitStr}
            ${offsetStr}
            `;
    }

    export function unlockAlignmentsByUser(user: Rdf.Iri) {
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();
        return `${prefices}
            DELETE {
            #unlockAlignmentsByUser
                ?g  ${isLockedByLink} ${user} .
            }
            WHERE { ?g  ${isLockedByLink} ${user} .}
            `;
    }

    export function deleteAllAlignments() {
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();
        return `${prefices}
            DELETE {
            #deleteAlignmentsByUser
                GRAPH ?g { ?x ?y ?z. }
            }
            WHERE {
                GRAPH ?g { ?x ?y ?z.
                ?s  ${alignmentLink} ?o. }
                MINUS { ?g ${isLockedByLink} ?user. }
            }`;
    }

    export function selectByAlignmentGraph(alignmentNG: Rdf.Iri): string {
        const alignmentLink = AligmentRdfLink();
        return `SELECT DISTINCT ?sourceNG ?targetNG
                WHERE {
            #selectAlignmentGraphs
                GRAPH ${alignmentNG} { ?sourceNG  ${alignmentLink} ?targetNG }
            }`;
    }

    export function selectAlignmentGraphsCount(bindVar: string): string {
        const alignmentLink = AligmentRdfLink();
        return `SELECT DISTINCT(COUNT(?g) as ?${bindVar})
            WHERE {
            #selectAlignmentGraphsCount
                GRAPH ?g { ?s  ${alignmentLink} ?o }
            }`;
    }

    export function selectGraphByPredicate_size(predicate: Rdf.Iri): string {
        return `SELECT ?size 
        WHERE{
                {
                    SELECT(COUNT(*) as ?number)
                    WHERE{
                        {
                            select distinct ?graph {
                                GRAPH ?graph { ?s ${predicate} ?o }
                            }
                        }
                    } LIMIT 1
                }
                BIND(IF(?number >= 1000, '>=1000', ?number) as ?size)
            }`;

    }

    export function selectAlignmentGraphLabel(alignmentNG: Rdf.Iri): string {
        return `${prefices}
        SELECT ?label 
        FROM ${alignmentNG} 
        WHERE {
            GRAPH ${alignmentNG} { ${alignmentNG}  ${labelRelation} ?label }
        } LIMIT 1`;
    }

    //SELECT ?size WHERE{ {SELECT (COUNT(*) as ?number) WHERE{ {select distinct ?graph { GRAPH ?graph { { ?s <http://www.w3.org/2004/02/skos/core#inScheme> ?o}  } }}} LIMIT 1} BIND(IF(?number>=1000, '>=1000', ?number) as ?size)}

    export function selectAlignmentUser(alignmentNG: Rdf.Iri, bindVar: string): string {
        const isLockedByLink = AligmentLockedByRdfLink();
        return `SELECT DISTINCT ?${bindVar}
            WHERE {
            #selectAlignmentUser
                GRAPH ${alignmentNG} { ?s  ${isLockedByLink} ?${bindVar} }
            }`;
    }

    export function selectNonAlignedSourceTerms(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string): string {
        parentshipRelation = parentshipRelation ? parentshipRelation : "rdf:undefined";
        return `${prefices}
            SELECT DISTINCT ?sourceTerm    #?label
            FROM ${alignmentNG}
            WHERE {
            #selectNonAlignedSourceTerms
                {
                    #Non - aligned excluded - top - terms
                    GRAPH ${sourceNG} { ?sourceTerm ${parentshipRelation} ?parentTerm. }
                    OPTIONAL { ?sourceTerm ?rel ?termY. } #@alignmentNG
                    OPTIONAL { ?parentTerm ?rel2 ?termY2. } #@alignmentNG
                    FILTER(!BOUND(?termY) && BOUND(?termY2))
                }
                UNION
                {
                    #Non - aligned root - terms
                    GRAPH  ${sourceNG} {
                    #1. Get all root - terms
                        ?sourceTerm ${typeRelation} ?type.
                            FILTER (${typesRootQuery})
                        MINUS{ ?sourceTerm ${parentshipRelation} ?parentTerm }
                    }
                    MINUS {
                    #2. Remove the implicitly / explicitly aligned - root - terms
                        ?sourceTerm ?relK ?targetY.#@alignmentNG
                    }
                    MINUS {
                    #3. Remove the root - terms that contain explicitly aligned terms
                        GRAPH  ${sourceNG} { ?child (${parentshipRelation}) + ?sourceTerm }
                    ?child ?relL ?targetZ.#@alignmentNG
                        GRAPH ${targetNG} { ?targetZ ?z1 ?z2 }
                    }
                }


                #GRAPH ${sourceNG} { OPTIONAL { ?sourceTerm(skos: prefLabel | (gvp: prefLabelGVP / xl: literalForm) | rdfs: label | dc: title) ?label. } }

            }`;
    }


}







//  UNION
//             {
//                 #Non-aligned top-terms (non-root)
//                 GRAPH ${sourceNG} {
//                     ?sourceTerm ${parentshipRelation} ?parentTerm .
//                   	{ ?sibling ${parentshipRelation} ?parentTerm . }
//                   	FILTER( ?sourceTerm != ?sibling )
// 					OPTIONAL { ?child (${parentshipRelation})+ ?sourceTerm . }
//                 }

//                 { 
//                   ?sibling  (${exactMatchAlignmentRelation.iri}|${broadMatchAlignmentRelation.iri})  ?termD .
//                   MINUS{ ?termD  ?relQ ?termE . }
//                 }

//                 MINUS { 
//                     ?sourceTerm ?relA ?termA .  #@alignmentNG
//                 }
//                 MINUS { 
//                     ?parentTerm ?relB ?termB .  #@alignmentNG
//                 }
//                 OPTIONAL { ?child ?relC ?termC .}  #@alignmentNG
//                 MINUS { 
//                   	GRAPH  ${targetNG} { ?termC ?relTermC ?targetTermC . }
//                 }
//             }