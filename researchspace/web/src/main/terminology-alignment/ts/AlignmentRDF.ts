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

import {
    Component, DOM as D, ReactElement, createElement, createFactory, ReactNode,
} from 'react';
import { Rdf } from 'platform/api/rdf';
import { RDFGraphStoreService } from 'platform/api/services/rdf-graph-store';
//import { assign } from 'lodash';
import * as _ from 'lodash';
import * as Kefir from 'kefir';
import { List, Iterable, Set } from 'immutable';

import {
    Node,
    // NodeTreeSelector,
    // NodeTreeProps,
    // EmptyForest,
    // queryMoreChildren,
    // RootsChange,
    // restoreForestFromLeafs,
} from 'platform/components/semantic/lazy-tree/NodeModel';

import { select, ask, executeSparqlUpdate, setBindings, SparqlSelectResult, streamSparqlQuery } from 'platform/api/sparql/SparqlClient';
import { SparqlUtil, SparqlClient } from 'platform/api/sparql';
import { serialize } from 'platform/api/rdf/formats/turtle';
import { queriesTemplates as QUERY, AligmentRdfLink, AligmentLockedByRdfLink, AligmentCreatedByRdfLink, AligmentCreatedOnRdfLink, AligmentDefaultNG, getBroaderAlignmentRelation, getBroadMatchAlignmentRelation } from './queries';//const vars
import { getGraphData } from 'platform/components/semantic/graph/GraphInternals';
import { valueExists } from 'platform/components/semantic/chart/ChartingCommons';


export interface Relation {
    title: string
    iri: Rdf.Iri
}


export type TargetTermAlignmentType = {
    source: Rdf.Iri,
    sourceLabel: Rdf.Literal,
    relation: Rdf.Iri,
    target: Rdf.Iri,
    targetLabel: Rdf.Literal,
};

export type SourceTermAlignmentType = {
    source: Rdf.Iri
};

export module AlignmentRDF {


    export function duplicateAlignmentGraph(oldAlignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, alignmentNG: Rdf.Iri,
        termsToBeRemovedFromAlignmentGraph: () => Rdf.Iri[], user: Rdf.Iri, loadNewAlignmentFunc?: (newAlignmentNG: Rdf.Iri) => void) {
        const newAlignmentNG: Kefir.Property<Rdf.Iri> = setNG(sourceNG, targetNG, alignmentNG, user); //Init new alignment graph
        const oldGraphLabel = getAlignmentGraphLabel(oldAlignmentNG)
        newAlignmentNG.onValue(ng => {
            if (!ng) return;
            const newNG = ng;
            oldGraphLabel.onValue(graphLabel => {
                const oldGraphLabel = (graphLabel && graphLabel.label && graphLabel.label.value && graphLabel.label.value.length > 0 ?
                    graphLabel.label.value : undefined);
                if (!oldGraphLabel) return;
                // const regexGroup1 = `^.*(?=\\s*\\([0-9]+\\)\\s*$)+`; //prefix
                // const regexGroup2 = `\\s*\\([0-9]+\\)\\s*$`; //suffix
                // const name = oldGraphLabel.trim().match(`${regexGroup1}`);
                // const suffix = oldGraphLabel.trim().match(`${regexGroup2}`);
                // const counter = suffix ? suffix[0].trim().match(`[0-9]+`) : 0;
                // const new_counter = (counter ? parseInt(counter[0]) + 1 : "");
                // const newGraphLabel = name ? name[0] + ` (${new_counter})` : "";
                const newGraphLabel = oldGraphLabel ? oldGraphLabel.trim() : "";
                updateGraphLabel(newNG, newGraphLabel + "(upgraded @ " + new Date().toISOString());
            })

            //Get the alignment content
            const query = QUERY.selectAlignmentTriples(oldAlignmentNG, "s", "p", "o");
            //console.log("duplicateGraph query:" + query);///////////
            const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
            const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
            const res: Kefir.Property<Rdf.Graph> = resultQ.map(result => _.map(result.results.bindings)
                .map<Rdf.Triple>(tuple => Rdf.triple(tuple.s, <Rdf.Iri>tuple.p, tuple.o)))
                .map(Rdf.graph);

            // AlignmentRDF.uploadGraphAsync(ng, res, undefined);
            res.onValue(graphdata => {
                RDFGraphStoreService.updateGraph(newNG, graphdata)
                    .onValue(v => {
                        if (termsToBeRemovedFromAlignmentGraph) {
                            const removeTerms = termsToBeRemovedFromAlignmentGraph();
                            if (removeTerms.length > 0) {
                                removeAlignedTermsFromAlignmentGraph(newNG, removeTerms)
                                    .onValue(removed => {
                                        console.log("removeAlignedTermsFromAlignmentGraph completed!");
                                        loadNewAlignmentFunc(ng);
                                    });
                            } else { loadNewAlignmentFunc(ng); }
                        }
                    })
                    .onError((error: string) => {
                        // TODO error handling
                        console.log(error);
                    })
            })
                .onError((error: string) => {
                    // TODO error handling
                    console.log(error);
                });
        })
    }

    export function askQuery(query: string): Kefir.Property<Boolean> {
        //console.log("selectQuery query:" + query);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(query);
        const resultQ: Kefir.Property<Boolean> = ask(askQuery);
        return resultQ;
    }

    // export function selectQueryDEL(query: string): Kefir.Property<SparqlSelectResult> {
    //     //console.log("selectQuery query:" + query);///////////
    //     const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
    //     const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
    //     return resultQ;
    // }
    export function selectQuery(query: string, endpoint?: string, repository?: string): Kefir.Property<SparqlSelectResult> {
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
        const options: SparqlClient.SparqlOptions = {
            endpoint: endpoint,
            context: { repository: repository }
        };
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery, options);
        return resultQ;
    }

    export function selectQueryResult(queryResult: Kefir.Property<any>): Kefir.Property<{ [key: string]: Rdf.Node }[]> {
        if (!queryResult) return Kefir.constant(undefined);
        const res: Kefir.Property<{ [key: string]: Rdf.Node }[]> = queryResult
            .map(result =>
                _.map(result.results.bindings //binding=tuple
                    .map(tuple => (<{ [key: string]: Rdf.Node }>tuple))));
        return res;
    }

    export function selectTermLabel(term: Rdf.Iri, labelNG?: Rdf.Iri): Kefir.Property<List<Rdf.Node>> {
        const query = QUERY.selectTermLabel(term, labelNG);
        //console.log("selectTermLabel query:" + query);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<List<Rdf.Node>> = resultQ.map(result => _.map(result.results.bindings)
            .reduce((list, binding) => {
                return list.push(binding["label"]);
            }, List<Rdf.Node>()));
        return res;
    }

    export function createAlignmentGraphTriple(sourceTerm: Rdf.Node, targetTerm: Rdf.Node, relation: Relation): Kefir.Property<Rdf.Graph> {
        let alignmentTriples: Array<Rdf.Triple> = [Rdf.triple(sourceTerm, relation.iri, targetTerm)];
        let g: Kefir.Property<Rdf.Graph> = Kefir.sequentially(0, [Rdf.graph(alignmentTriples)]).toProperty();
        return g;
    }

    export function createAlignmentGraph(sourceTerm: Rdf.Node, targetTerm: Rdf.Node, relation: Relation, sourceNG: Rdf.Iri, parentshipRelation: string,
        fullySelectedParentsArrays: Array<ReadonlyArray<Node>>,
        partiallySelectedParentsArrays: Array<ReadonlyArray<Node>>,
        onlySourceTermChildren: boolean,//NEW
    ): Kefir.Property<Rdf.Graph> {

        const omitSourceTermRootFlag = onlySourceTermChildren;//NEW
        let alignmentTriples: Array<Rdf.Triple> = (omitSourceTermRootFlag ? [] : [Rdf.triple(sourceTerm, relation.iri, targetTerm)]);//Add the sourceTerm (if omit==false)
        let parentshipTriples: Array<Rdf.Triple> = [];
        let branchNodes: Array<Rdf.Iri> = []; //+ new Rdf.Iri(sourceTerm.value); //contain children
        const branchNodesDelimiter = " ";


        //Create the parentship relations from the sourceTerm down to the selected-nodes and collect the selected-branchnodes to get all their children
        if (fullySelectedParentsArrays) {
            fullySelectedParentsArrays.forEach(nodeArray => {
                nodeArray.forEach((item, i) => {
                    if (i < nodeArray.length - 1) {
                        const nextItem = nodeArray[i + 1];
                        let newtriple = Rdf.triple(nextItem.iri, getBroaderAlignmentRelation().iri, item.iri);
                        if (omitSourceTermRootFlag && item.iri.value == sourceTerm.value) { newtriple = Rdf.triple(nextItem.iri, relation.iri, targetTerm); }
                        if (!parentshipTriples.find(trpl => trpl == newtriple))
                            parentshipTriples.push(newtriple);
                    } else {
                        //get the last node
                        branchNodes.push(item.iri);
                    }
                })
            })
        }

        if (partiallySelectedParentsArrays) {
            partiallySelectedParentsArrays.forEach(nodeArray => {
                nodeArray.forEach((item, i) => {
                    if (i < nodeArray.length - 1) {
                        const nextItem = nodeArray[i + 1];
                        let newtriple = Rdf.triple(nextItem.iri, getBroaderAlignmentRelation().iri, item.iri);
                        if (omitSourceTermRootFlag && item.iri.value == sourceTerm.value) { newtriple = Rdf.triple(nextItem.iri, relation.iri, targetTerm); }
                        parentshipTriples.push(newtriple);
                    }
                })
            })
        }


        const querySelectSourceTermHierarchy = QUERY.selectTermsHierarchy(sourceNG, branchNodes.join(" "), parentshipRelation);
        //console.log("createAlignmentGraph query:" + querySelectSourceTermHierarchy);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(querySelectSourceTermHierarchy);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const graph: Kefir.Property<Rdf.Graph> = resultQ.map(result => _.map(result.results.bindings //bindings: the result set, binding:a result single-tuple
            .map(binding => ({
                child: binding["child"],
                item: binding["item"]
            }))) //up to here we have the an iterable with tuples

            .reduce((triples: Array<Rdf.Triple>, tuple) => {
                if (!tuple["child"]) return triples;
                const currItem: Rdf.Node = tuple["item"];
                const newtriple = (omitSourceTermRootFlag && sourceTerm.value == currItem.value ? Rdf.triple(tuple["child"], getBroadMatchAlignmentRelation().iri, targetTerm) : Rdf.triple(tuple["child"], getBroaderAlignmentRelation().iri, currItem));
                triples.push(newtriple);
                return triples;
            }, new Array<Rdf.Triple>()) //reduce: up to here we propduced a triples-array
        ).map(tripleSet => {
            alignmentTriples.forEach(trpl => (<Array<Rdf.Triple>>tripleSet).push(trpl));
            tripleSet = (<Array<Rdf.Triple>>tripleSet).concat(parentshipTriples);
            return Rdf.graph(<Array<Rdf.Triple>>tripleSet);
        });
        return graph;
    }

    //NEW //TBCHECKED
    export function getTermDirectNonAlignedChildren(ng: Rdf.Iri, term: Rdf.Iri, targetNG: Rdf.Iri): Kefir.Property<any> {
        const querySelectDirectNonAlignedChildren = QUERY.selectDirectNonAlignedChildren(ng, term, targetNG);
        //console.log("getTermDirectNonAlignedChildren query:" + querySelectDirectNonAlignedChildren);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(querySelectDirectNonAlignedChildren);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                child: binding["child"],
            })))).map(result => {
                return result;
            });
        return res;
    }


    export function getAlignmentMultiplicityOfSourceTerm(sourceTerm: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri): Kefir.Property<any> {
        const selectQuery = QUERY.selectAlignmentMultiplicityOfSourceTerm(alignmentNG, sourceNG, targetNG, sourceTerm);
        //console.log("getAlignmentMultiplicityOfSourceTerms query:" + selectQuery);///////////
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                child: binding["child"],
                alignmentMultiplicity: binding["alignmentMultiplicity"]
            })))).map(result => {
                return result;
            });
        return res;
    }

    //old
    export function getRemovableDirectChildren(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri): Kefir.Property<any> {
        const query = QUERY.selectRemovableDirectChildren(alignmentNG, sourceNG, sourceTerm, targetTerm);
        //console.log("getRemovableDirectChildren query:" + query);///////////
        const resultQ: Kefir.Property<SparqlSelectResult> = select(query);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                child: binding["child"],
                //removable: binding["removable"]
            })))).map(result => {
                return result;
            });
        return res;
    }
    export function isRemovableNode(alignmentNG: Rdf.Iri, sourceTerm: Rdf.Iri, relation: Rdf.Iri, targetTerm: Rdf.Iri): Kefir.Property<boolean> {
        const askQ = QUERY.askIsRemovableNode(alignmentNG, sourceTerm, relation, targetTerm);
        console.log("isRemovableNode query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        return resultQ;
    }


    // export function getParentsOfRemovableAlignedTermDEL(alignmentNG: Rdf.Iri, removableTerm: Rdf.Iri): Kefir.Property<any> {
    //     const query = QUERY.selectParentsOfRemovableAlignedTermDEL(alignmentNG, removableTerm);
    //     //console.log("getRemovableDirectChildren query:" + query);///////////
    //     const resultQ: Kefir.Property<SparqlSelectResult> = select(query);
    //     const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
    //         .map(binding => ({
    //             parent: binding["parent"],
    //             //removable: binding["removable"]
    //         })))).map(result => {
    //             return result;
    //         });
    //     return res;
    // }

    export function getSourceTermParentAtAlignment(sourceTerm: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, parentshipRelation: string): Kefir.Property<any> {
        const query = QUERY.selectTermAlignedParents(alignmentNG, sourceNG, sourceTerm, parentshipRelation);
        //console.log("getSourceTermParentAtAlignment query:" + query);///////////
        const resultQ: Kefir.Property<SparqlSelectResult> = select(query);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                parent: binding["parent"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getSourceTermDirectChildrenAtGraph(sourceTerm: Rdf.Iri, NG: Rdf.Iri, labelNG: Rdf.Iri, parentshipRelation: () => string): Kefir.Property<any> {
        const query = QUERY.selectTermDirectChildrenAtGraph(NG, labelNG, sourceTerm, parentshipRelation());
        //console.log("getSourceTermDirectChildrenAtGraph query:" + query);///////////
        const resultQ: Kefir.Property<SparqlSelectResult> = select(query);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                child: binding["child"],
                label: binding["label"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function removeAlignedTermsFromAlignmentGraph(alignmentNG: Rdf.Iri, terms: Rdf.Iri[], func?: () => void): Kefir.Property<any> {
        const query = QUERY.deleteTermsFromNG(alignmentNG, terms);
        //console.log("removeAlignedTermsFromAlignmentGraph query:" + query);///////////
        const updateQuery: SparqlJs.Update = SparqlUtil.parseQuerySync<SparqlJs.Update>(query);
        //executeSparqlUpdate(updateQuery).onValue(v => { if (func) func(); console.log("Triple deleted") }).onError(e => console.log("Error" + e));
        return executeSparqlUpdate(updateQuery);
    }

    export function removeAlignedSourceTermFromAlignmentGraph(alignmentNG: Rdf.Iri, sourceTerm: Rdf.Iri, relation: Rdf.Iri, targetTerm: Rdf.Iri, func?: () => void): Kefir.Property<any> {
        const query = QUERY.deleteTripleInNG(alignmentNG, sourceTerm, relation, targetTerm);
        //console.log("removeAlignedSourceTermFromAlignmentGraph query:" + query);///////////
        const updateQuery: SparqlJs.Update = SparqlUtil.parseQuerySync<SparqlJs.Update>(query);
        //executeSparqlUpdate(updateQuery).onValue(v => { if (func) func(); console.log("Triple deleted") }).onError(e => console.log("Error" + e));
        return executeSparqlUpdate(updateQuery);
    }

    export function removeSourceChildTermFromAlignmentGraph(alignmentNG: Rdf.Iri, ntriples: string): Kefir.Property<any> {
        const query = QUERY.deleteTriplesInNG(alignmentNG, ntriples);
        //console.log("removeSourceChildTermFromAlignmentGraph2 query:" + query);///////////
        const updateQuery: SparqlJs.Update = SparqlUtil.parseQuerySync<SparqlJs.Update>(query);
        return executeSparqlUpdate(updateQuery);
    }

    export function removeExclusiveTermAlignedChildren(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string, func?: () => void): Kefir.Property<any> {
        const query = QUERY.deleteExclusiveTermAlignedChildren(alignmentNG, sourceNG, targetNG, sourceTerm, targetTerm, parentshipRelation);
        //console.log("removeExclusiveTermAlignedChildren query:" + query);///////////
        //const query2 = QUERY.selectToCheckExclusiveTermAlignedChildren(alignmentNG, sourceNG, targetNG, sourceTerm, targetTerm);
        //console.log("removeExclusiveTermAlignedChildren query2:" + query2);///////////
        const updateQuery: SparqlJs.Update = SparqlUtil.parseQuerySync<SparqlJs.Update>(query);
        //executeSparqlUpdate(updateQuery).onValue(v => { if (func) func(); console.log("Triple deleted") }).onError(e => console.log("Error" + e));
        return executeSparqlUpdate(updateQuery);
    }

    //NEW
    export function getOrphanAlignedTerms(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string) {
        const query = QUERY.selectNonAlignedTermsFromAlignmentGraph(alignmentNG, sourceNG, targetNG, parentshipRelation);
        // console.log("getOrphanAlignedTerms query:" + query);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<{ child: Rdf.Iri, deleteChild: Rdf.Literal, orphanTerm: Rdf.Iri }[]> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                child: <Rdf.Iri>binding["child"],
                deleteChild: <Rdf.Literal>binding["deleteChild"],
                orphanTerm: <Rdf.Iri>binding["orphanTerm"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function uploadGraphAsync(alignmentNG: Rdf.Iri, graph: Kefir.Property<Rdf.Graph>, childrenQ?: string): Kefir.Property<Kefir.Property<Kefir.Property<Kefir.Property<SparqlSelectResult>>>> {
        return graph.map(g => {
            return serialize.serializeGraph(g, serialize.Format.NTriples).map(ntriples => {
                const insertQuery = QUERY.insertTriplesInNG(alignmentNG, ntriples);
                //console.log("uploadGraphAsync insertQuery:" + insertQuery);///////////
                return executeSparqlUpdate(insertQuery).map(v => {
                    console.log('SPARQL Update Operation executed!');
                    return childrenQ ? select(childrenQ) : undefined;
                }).onError((e: Error) => {
                    console.log("Error");
                    console.log(e.message);
                });
            });
        });
    }

    //for some unknown reason I couldn't use the uploadGraphAsync() for the case of closeMatch and relatedMatch, although the arguments are similar
    export function uploadTriple(alignmentNG: Rdf.Iri, ntriples: string): void {
        const insertQuery = QUERY.insertTriplesInNG(alignmentNG, ntriples);
        //console.log("uploadTriple insertQuery:" + insertQuery);///////////
        executeSparqlUpdate(insertQuery)
            .map(v => console.log('SPARQL Update Operation executed!'))
            .onValue(v => v)
            .onError((e: Error) => {
                console.log("Error");
                console.log(e.message);
            });


    }


    //Selects (or defines) an Alignment graph by triple <source, alignmentLink, target> 
    export function setNG(sourceNG: Rdf.Iri, targetNG: Rdf.Iri, alignmentNG: Rdf.Iri, user?: Rdf.Iri): Kefir.Property<Rdf.Iri> {
        const bindVar = "iri";
        const alignmentLink = AligmentRdfLink();
        const isLockedByLink = AligmentLockedByRdfLink();
        const isCreatedByLink = AligmentCreatedByRdfLink();
        const isCreatedOnLink = AligmentCreatedOnRdfLink();

        //Option 1: always create a new alignment when alignmentNG is undefined
        const NGraph_md: { iri: Rdf.Iri, timestamp: string } = (alignmentNG ? { iri: alignmentNG, timestamp: undefined } : AligmentDefaultNG(sourceNG, targetNG));
        const newNG: Rdf.Iri = NGraph_md.iri;
        const newNGTimestamp: string = NGraph_md.timestamp;
        let ntriples = `${sourceNG} ${alignmentLink} ${targetNG} .`;            //set alignment terminology members
        //if (user) ntriples += `\n${newNG} ${isLockedByLink} ${user} .`;   //set alignment lock
        if (!alignmentNG && user) ntriples += `\n${newNG} ${isCreatedByLink} ${user} .`; //for a newly created graph
        if (!alignmentNG && newNGTimestamp) ntriples += `\n${newNG} ${isCreatedOnLink} "${newNGTimestamp}".`;


        //const insertQuery = QUERY.insertTripleInNG(newNG, source, alignmentLink, target);
        const insertQuery = QUERY.insertTriplesInNG(newNG, ntriples);
        //console.log("setNG query:" + insertQuery);///////////
        executeSparqlUpdate(insertQuery).onValue(x => console.log("Add initial triple(s)"));
        let NG: Kefir.Property<Rdf.Iri> = Kefir.constant(newNG);

        //Option 2: try to load the existing alignment otherwise create a new one
        // const query = QUERY.selectNGByTriple(bindVar, source, alignmentLink, target);
        // //console.log("setNG query:" + query);///////////
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
        // const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        // //return resultQ.map(result => _.map(result.results.bindings, binding => binding[bindVar])).map(result => result[0] as Rdf.Iri);

        // let NG: Kefir.Property<Rdf.Iri> = resultQ.map(result => _.map(result.results.bindings, binding => binding[bindVar])).map(result => {
        //     if (!result[0]) {
        //         const newNG = AligmentDefaultNG(source, target);
        //         const insertQuery = QUERY.insertTripleInNG(newNG, source, alignmentLink, target);

        //         executeSparqlUpdate(insertQuery).onValue(x => console.log("Add initial triple"));
        //         return newNG;
        //     }
        //     return result[0] as Rdf.Iri
        // });
        return NG;
    }
    export function updateGraphLabel(NG: Rdf.Iri, label: string): void {
        const updateQuery = QUERY.updateGraphLabel(NG, label);
        //console.log("updateGraphLabel query:" + updateQuery);///////////
        executeSparqlUpdate(updateQuery).onValue(x => console.log("Label updated"));
    }

    export function getAlignments(alignmentNG: Kefir.Property<Rdf.Iri>): void {
        const bindVars = { s: "s", r: "r", t: "t" };
        alignmentNG.onValue(NGIri => {
            const query = QUERY.selectAlignmentTriples(NGIri, bindVars.s, bindVars.r, bindVars.t);
            //console.log("getAlignments query:" + query);///////////
            const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
            const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
            resultQ.map(result => _.map(result.results.bindings
                .map(binding => ({
                    source: binding[bindVars.s],
                    target: binding[bindVars.t],
                    relation: binding[bindVars.r]
                })))).onValue(result => {
                    result.forEach(item => {
                        //console.log("---------------------------")
                        //console.log(item.source);
                        //console.log(item.relation);
                        //console.log(item.target);
                        //console.log("---------------------------")
                    })
                });
        });
    }

    export function isAlignedSource(alignmentNG: Rdf.Iri, sourceTerm: Rdf.Iri): Kefir.Property<boolean> {
        return isTermSubjectInNG(alignmentNG, sourceTerm);
    }

    export function isSourceTermAtTarget(targetNG: Rdf.Iri, term: Rdf.Iri): Kefir.Property<boolean> {
        return isTermSubjectInNG(targetNG, term);
    }

    export function isTermSubjectInNG(NG: Rdf.Iri, term: Rdf.Iri): Kefir.Property<boolean> {
        const askQ = QUERY.askSubjectFromNG(NG, term);
        //console.log("isTermSubjectInNG query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }

    export function isTermInNG(NG: Rdf.Iri, term: Rdf.Iri): Kefir.Property<boolean> {
        const askQ = QUERY.askTermInNG(NG, term);
        //console.log("isTermInNG query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }

    export function getAllTargetAlignments(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri): Kefir.Property<TargetTermAlignmentType[]> {
        const bindVars = { s: "s", r: "r", t: "t", label: "label", targetLabel: "targetLabel" };
        const q = QUERY.selectTargetAlignments(alignmentNG, sourceNG, targetNG, bindVars.s, bindVars.r, bindVars.t, bindVars.label, bindVars.targetLabel);
        //console.log("getAllTargetAlignments query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<TargetTermAlignmentType[]> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                source: <Rdf.Iri>binding[bindVars.s],
                sourceLabel: <Rdf.Literal>binding[bindVars.label],
                relation: <Rdf.Iri>binding[bindVars.r],
                target: <Rdf.Iri>binding[bindVars.t],
                targetLabel: <Rdf.Literal>binding[bindVars.targetLabel],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getAllSourceAlignments(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri): Kefir.Property<SourceTermAlignmentType[]> {
        const bindVars = { s: "s" };
        const q = QUERY.selectSourceAlignments(alignmentNG, sourceNG, bindVars.s);
        //console.log("getAllSourceAlignments query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<SourceTermAlignmentType[]> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                source: <Rdf.Iri>binding[bindVars.s],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getAlignedTermsBySuperSourceTerm(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, superSourceTerm: Rdf.Iri, parentshipRelation: string): Kefir.Property<{ sTerm: Rdf.Iri, sLabel: Rdf.Literal, rel: Rdf.Iri, tTerm: Rdf.Iri, tLabel: Rdf.Literal }[]> {
        const bindVars = { sTerm: "sTerm", sLabel: "sLabel", rel: "rel", tTerm: "tTerm", tLabel: "tLabel" };
        const q = QUERY.selectAlignedTermsBySuperSourceTerm(alignmentNG, sourceNG, superSourceTerm, parentshipRelation);
        //console.log("getAlignedTermsBySuperSourceTerm query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                sTerm: <Rdf.Iri>binding[bindVars.sTerm],
                sLabel: <Rdf.Literal>binding[bindVars.sLabel],
                rel: <Rdf.Iri>binding[bindVars.rel],
                tTerm: <Rdf.Iri>binding[bindVars.tTerm],
                tLabel: <Rdf.Literal>binding[bindVars.tLabel],
            })))).map(result => {
                return result;
            });
        return res;
    }

    //Maybe not used
    export function getAlignmentsOfTargetTerm(alignmentNG: Rdf.Iri, targetTerm: Rdf.Iri): Kefir.Property<any> {
        const bindVars = { s: "s", r: "r" };
        const q = QUERY.selectTargetTermAlignments(alignmentNG, targetTerm, bindVars.s, bindVars.r);
        //console.log("getAlignmetsOfTargetTerm query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                source: binding[bindVars.s],
                relation: binding[bindVars.r]
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getParents(ngList: Rdf.Iri[], terms: Rdf.Iri[] | string[], parentshipRelation: string): Kefir.Property<any> {
        const q = QUERY.selectParentHierarchy(ngList, terms, parentshipRelation);
        //console.log("getParents query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                parent: binding["parent"],
                child: binding["child"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getDirectParents(ngList: Rdf.Iri[], term: Rdf.Iri, parentshipRelation: string, ngLabelList?: Rdf.Iri[]): Kefir.Property<any> {
        const q = QUERY.selectDirectParents2(ngList, term, parentshipRelation, ngLabelList);
        //console.log("getDirectParents query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                parent: binding["parent"],
                parentLabel: binding["parentLabel"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getHierarchyOptions(ng: Rdf.Iri, ...options: string[]): Kefir.Property<any> {
        const q = QUERY.selectHierarchyOptions(ng, ...options);
        //console.log("getHierarchyOptions query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                option: binding["option"],
            })))).map(result => {
                return result;
            });
        return res;
    }



    //Solution 1 (automatic retrieval of the preferred language)
    export function createPreferredLangsSPARQLSection(sourceNG: Rdf.Iri, bindVarS: string, bindVarL: string, bindVarS2: string, bindVarL2: string): string {
        const section = QUERY.createPreferredLangsSPARQLSection(sourceNG, bindVarS, bindVarL, bindVarS2, bindVarL2);
        //console.log("createPreferredLangsSPARQLSection section:" + section);///////////
        return section;
    }

    //Solution 2 (automatic retrieval of the preferred language)
    export function createPreferredLangsSPARQLSection2(sourceNG: Rdf.Iri, bindVarS: string, bindVarL: string, bindVarS2: string, bindVarL2: string, bindVarLang2: string): string {
        const section = QUERY.createPreferredLangsSPARQLSection2(sourceNG, bindVarS, bindVarL, bindVarS2, bindVarL2, bindVarLang2);
        //console.log("createPreferredLangsSPARQLSection2 section:" + section);///////////
        return section;
    }

    //Solution 3 (preferred language filtering)
    export function createFilterPreferredLangsSPARQLSection(bindVarLabel: string): string {
        const section = QUERY.createFilterPreferredLangsSPARQLSection(bindVarLabel);
        //console.log("createFilterPreferredLangsSPARQLSection section:" + section);///////////
        return section;
    }

    //NOT USED
    export function hasSourceTermAlignedChildren(term: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, parentshipRelation: string, targetNG?: Rdf.Iri): Kefir.Property<boolean> {
        const askQ = QUERY.askSourceTermHasAlignedDescendants(term, alignmentNG, sourceNG, parentshipRelation, targetNG);
        //console.log("hasSourceTermAlignedChildren query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }
    //NOT USED
    export function hasTargetTermAlignedChildren(term: Rdf.Iri, alignmentNG: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string): Kefir.Property<boolean> {
        const askQ = QUERY.askTargetTermHasAlignedDescendants(term, alignmentNG, targetNG, parentshipRelation);
        //console.log("hasTargetTermAlignedChildren query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }

    //Rule 1 & 2
    export function isSourceTargetRelatedDirectly(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, relation: Rdf.Iri, alignmentNG: Rdf.Iri, targetNG: Rdf.Iri): Kefir.Property<boolean> {
        const askQ = QUERY.askSourceTargetRelatedDirectly(sourceTerm, targetTerm, relation, alignmentNG, targetNG); //NEW!!!!!!!!!!!  
        //console.log("isSourceTargetRelatedDirectly query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res)); //res.results.bindings.length
        return resultQ;
    }

    //Rule 3
    export function isSourceInTargetHierarchy(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string): Kefir.Property<boolean> {
        const askQ = QUERY.askSourceExistsInTargetHierarchy(sourceTerm, targetTerm, targetNG, parentshipRelation);
        //console.log("isSourceInTargetHierarchy query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }

    //Rule 4
    export function getSourceIndirectRelatedToTarget(sourceTerm: Rdf.Iri, targetTerm: Rdf.Iri, alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, parentshipRelation: string, targetNG?: Rdf.Iri): Kefir.Property<any> {
        const q = QUERY.selectSourceIndirectRelatedToTarget(sourceTerm, targetTerm, alignmentNG, sourceNG, parentshipRelation, targetNG);
        //console.log("selectSourceIndirectRelatedToTarget query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                relCase: binding["relCase"],
                relCaseTerm: binding["relCaseTerm"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function isAlignmentLocked(alignmentNG: Rdf.Iri, user?: Rdf.Iri): Kefir.Property<boolean> {
        const isLockedByLink = AligmentLockedByRdfLink();
        const askQ = QUERY.askTripleExistsInNG(alignmentNG, alignmentNG, isLockedByLink, (user ? user : "?anyUser"));
        //console.log("isAlignmentLocked query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }

    //Decides when to allow/disallow lock changes. If true lock change is forbidden.
    export function isAlignmentLockedByOtherUser(alignmentNG: Rdf.Iri, user: Rdf.Iri): Kefir.Property<boolean> {
        const askQ = QUERY.askIsLockedByOtherUser(alignmentNG, user);
        //console.log("isAlignmentLockedByOtherUser query:" + askQ);///////////
        const askQuery: SparqlJs.AskQuery = SparqlUtil.parseQuerySync<SparqlJs.AskQuery>(askQ);
        const resultQ: Kefir.Property<boolean> = SparqlClient.ask(askQuery);
        // const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(askQ);
        // const resultQ: Kefir.Property<boolean> = SparqlClient.select(selectQuery).map(res => isSelectResultEmpty(res));
        return resultQ;
    }

    export function toggleAlignmentLocked(alignmentNG: Rdf.Iri, user: Rdf.Iri, func: (boolean) => any): void {
        const isLockedByLink = AligmentLockedByRdfLink();
        let ntriples = "";
        if (user) ntriples += `${alignmentNG} ${isLockedByLink} ${user} .`;     //set alignment lock

        //const insertQuery = QUERY.insertTriplesInNG(alignmentNG, ntriples); //LOCK
        //const deleteQuery = QUERY.deleteTriplesInNG(alignmentNG, ntriples); //UNLOCK
        isAlignmentLocked(alignmentNG, user).onValue(res => {
            //console.log("isAlignmentLocked? " + res)
            const updateQuery = res ? QUERY.deleteTriplesInNG(alignmentNG, ntriples) : QUERY.insertTriplesInNG(alignmentNG, ntriples);
            //console.log("toggleAlignmentLocked updateQuery:" + updateQuery);///////////
            executeSparqlUpdate(updateQuery).onValue(res2 => {//no returned value: res2 is always null
                //console.log("isAlignmentLocked after executed sends lock= " + res)
                func(!res);
            });
        })
    }

    export function unlockAlignmentsByUser(user: Rdf.Iri, func?: () => any): void {
        const isLockedByLink = AligmentLockedByRdfLink();
        const updateQuery = QUERY.unlockAlignmentsByUser(user);
        //console.log("unlockAlignmentsByUser updateQuery:" + updateQuery);///////////
        executeSparqlUpdate(updateQuery).onValue(res => {//res is null
            if (func) func();
        });
    }

    export function deleteAllAlignments(func?: () => any): void {
        const isLockedByLink = AligmentLockedByRdfLink();
        const updateQuery = QUERY.deleteAllAlignments();
        //console.log("deleteAllAlignments updateQuery:" + updateQuery);///////////
        executeSparqlUpdate(updateQuery).onValue(res => {//res is null
            if (func) func();
        }).onError((e: Error) => {
            console.log("Error deleteAllAlignments");
            console.log(e.message);
        });
    }


    export function getAlignmentsLockedByUser(user: Rdf.Iri) {
        const q = QUERY.selectAlignmentGraphsByUser("graph", user);
        //console.log("getAlignmentsLockedByUser q:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                graph: binding["graph"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getRequestedAlignedChildren(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, sourceTerm: Rdf.Iri, sourceDescendantsQuery: string, parentshipRelation: string): Kefir.Property<List<Node>> {
        sourceDescendantsQuery = (!sourceDescendantsQuery) ? QUERY.selectSourceDescendantsQuery(alignmentNG, sourceNG, sourceTerm, parentshipRelation) : sourceDescendantsQuery;
        //console.log("getRequestedAlignedChildren query:" + sourceDescendantsQuery);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(sourceDescendantsQuery);

        return select(selectQuery).map(result => result.results.bindings
            .map<Node>(tuple => ({ iri: tuple["item"], label: tuple["itemLabel"], children: List<Node>(), hasMoreItems: Boolean(tuple["hasChildren"]) } as Node))
            .reduce((list: List<Node>, node) => {
                if (!node["iri"]) { return list; }
                return list.push(node);
            }, List<Node>()));
    }

    export function getAdditionalInfo(ngList: Rdf.Iri[], term: Rdf.Iri): Kefir.Property<any> {
        const q = QUERY.selectAdditionalInfo(ngList, term);
        //console.log("getAdditionalInfo query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                scopeNote: binding["scopeNote"],
                lang: binding["lang"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getSchemeGraphs(limit?: number, offset?: number): Kefir.Property<any> {
        const q = QUERY.selectSchemeGraphs(limit, offset);
        //console.log("getSchemeGraphs query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                graph: binding["graph"],
                scheme: binding["scheme"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function selectSchemeByNG(ng: Rdf.Iri): Kefir.Property<any> {
        const q = QUERY.selectSchemeByNG(ng);
        //console.log("selectSchemeByNG query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                scheme: binding["scheme"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function selectAlignmentGraphsBySourceOrTarget(bindVar: string, NG1: Rdf.Iri, NG2?: Rdf.Iri): Kefir.Property<any> {
        const q = QUERY.selectAlignmentGraphsBySourceOrTarget(bindVar, NG1, NG2);
        //console.log("selectAlignmentGraphsBySourceOrTarget query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                graph: binding[bindVar],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getAlignmentGraphs(bindVar: string, limit?: number, offset?: number): Kefir.Property<SparqlClient.Dictionary<Rdf.Node>[]> {
        const q = QUERY.selectAlignmentGraphs(bindVar, limit, offset);
        //console.log("getAlignmentGraphs query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                graph: binding[bindVar],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getUnlockedAlignmentGraphs(bindVar: string, limit?: number, offset?: number): Kefir.Property<SparqlClient.Dictionary<Rdf.Node>[]> {
        const q = QUERY.selectUnlockedAlignmentGraphs(bindVar, limit, offset);
        //console.log("getUnlockedAlignmentGraphs query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                graph: binding[bindVar],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getSourceTargetGraphsByAlignment(alignmentNG: Rdf.Iri): Kefir.Property<any> {
        const q = QUERY.selectByAlignmentGraph(alignmentNG);
        //console.log("getSourceTargetGraphsByAlignment query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);

        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                sourceNG: binding["sourceNG"],
                targetNG: binding["targetNG"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    export function getAlignmentGraphsCount(): Kefir.Property<number> {
        const q = QUERY.selectAlignmentGraphsCount("count");
        //console.log("getAlignmentGraphsCount query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<number> = resultQ.map(result => result.results.bindings["count"]);
        return res;
    }

    export function getAlignmentUser(alignmentNG: Rdf.Iri): Kefir.Property<number> {
        const q = QUERY.selectAlignmentUser(alignmentNG, "user");
        //console.log("getAlignmentGraphsCount query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<number> = resultQ.map(result => result.results.bindings["user"]);
        return res;
    }

    export function getAlignmentGraphLabel(alignmentNG: Rdf.Iri): Kefir.Property<{ label: Rdf.Node }> {
        const q = QUERY.selectAlignmentGraphLabel(alignmentNG);
        //console.log("getAlignmentGraphLabel query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<{ label: Rdf.Node }> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({ label: binding["label"] }))))
            .map(result => {
                return result[0];//return only the 1st result of a result-set
            });
        return res;
    }


    export function getNonAlignedSourceTerms(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, parentshipRelation: string): Kefir.Property<List<any>> {
        const q = QUERY.selectNonAlignedSourceTerms(alignmentNG, sourceNG, targetNG, parentshipRelation);
        //console.log("getNonAlignedSourceTerms query:" + q);///////////
        const selectQuery: SparqlJs.SelectQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(q);
        const resultQ: Kefir.Property<SparqlSelectResult> = select(selectQuery);
        const res: Kefir.Property<any> = resultQ.map(result => _.map(result.results.bindings
            .map(binding => ({
                sourceTerm: binding["sourceTerm"],
            })))).map(result => {
                return result;
            });
        return res;
    }

    // export function setGraphAsDeprecated(graph: Rdf.Iri, func?: () => any) {
    //     const updateQuery = QUERY.setGraphAsDeprecated(graph);
    //     //console.log("setGraphAsDeprecated updateQuery:" + updateQuery);///////////
    //     executeSparqlUpdate(updateQuery).onValue(res => {//res is null
    //         if (func) func();
    //     });
    // }



    function isSelectResultEmpty(res: SparqlSelectResult): boolean {
        if (!res || !res.results || !res.results.bindings) return false;
        return Boolean(res.results.bindings.length);
    }



}//module


