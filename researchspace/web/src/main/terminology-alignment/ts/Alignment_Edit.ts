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

import { DOM as D, Component, createFactory, createElement, ReactNode, ReactElement } from 'react';
import { findDOMNode } from 'react-dom';
import ReactBootstrap = require('react-bootstrap');
import {
    Button,
    Nav, NavItem, Alert,
    MenuItem,
} from 'react-bootstrap';
import { List } from 'immutable';
import * as _ from 'lodash';
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';
import Spinner from 'platform/components/ui/spinner/Spinner';


import { SemanticTreeInput as semanticTreeInput } from 'platform/components/semantic/lazy-tree/SemanticTreeInput.ts';
import { SinglePartialSubtree } from 'platform/components/semantic/lazy-tree/SelectionMode';
import { TreeSelection, SelectionNode } from 'platform/components/semantic/lazy-tree/TreeSelection';
import { KeyedForest } from 'platform/components/semantic/lazy-tree/KeyedForest';
import {
    Node, EmptyForest,
} from 'platform/components/semantic/lazy-tree/NodeModel';
import * as styles from 'platform/components/semantic/lazy-tree/SemanticTreeInput.scss';

import { Draggable } from 'platform/components/dnd/DraggableComponent.ts';
import { Droppable } from 'platform/components/dnd/DroppableComponent';

import { factory as semanticTree, SemanticTree } from './SemanticTree';
import { Alignment, AlignedTermsMapping } from './Alignment';
import { AlignmentRDF, SourceTermAlignmentType, TargetTermAlignmentType, } from './AlignmentRDF';
import { RulesComponent, RuleDesc } from './RulesComponent';
import { AlignedElement } from './alignedElement';
import { UI, AlignedGraphProps, GraphSelectorState } from './Alignment_Edit_UI';
import { QueriesConfig } from './Alignment_Edit_QueriesConfig';
import { DisplayAlignedTermsComponent } from './DisplayAlignedTerms';
import { OverlayDialogs } from './OverlayDialogs';
import "../css/term-align.scss";
import { Dictionary } from 'ontodia';
import { componentDisplayName, KefirComponentBase } from 'platform/components/utils';
import { EventEmitter } from 'events';
import { emit } from 'cluster';



interface Relation {
    title: string
    iri: Rdf.Iri
}

type Term = Node;

interface TreeProps {
    rootsQuery: string;
    childrenQuery: string;
    parentsQuery: string;
    searchQuery: string;
}

interface Props {
    user: Rdf.Iri;
    prefices: string;
    get_terminology_prefices?: (ng: Rdf.Iri) => string;
    typeRelation: string;
    typesRootQuery: string;
    typesChildrenQuery: string;
    typesParentQuery: string;
    typesSearchQuery: string;
    //parentshipRelation: string;
    hierarchyRelationOptions: string[];
    labelRelation: string;
    preferredLangs?: string[];
    queries: TreeProps;
    exactMatchAlignmentRelation: Relation;
    closeMatchAlignmentRelation: Relation;
    relatedMatchAlignmentRelation: Relation;
    broadMatchAlignmentRelation: Relation;
    broaderAlignmentRelation: Relation;
    //ADD-RELATION
    setCurrentAlignmentNG: (ng: Rdf.Iri) => void;
    graphSelectorLimit?: number;
    loadAlignmentID?: Rdf.Iri;
    alignmentRules: RuleDesc[];
    getNewVersionOfSynchronizedGraph?: (ng?: Rdf.Iri) => Map<string, Rdf.Iri>;
    currentAlignmentSyncNotificationFunc?: any;//Notifies the application for the current sync request
}

interface State {
    alignment: Alignment;
    selection: TreeSelection<Node>;

    loadingNewAlignment?: boolean;

    draggedTerm?: Term;
    expandNodeOnDrag?: Term;
    //showDialog?: (s: Node, t: Node) => any;

    searchSourceSelection?: TreeSelection<Node>;
    searchTargetSelection?: TreeSelection<Node>;
    selectionMode?: SinglePartialSubtree<Node>;
    dropAtSearch?: Rdf.Iri;//NOT USED
    focusTargetTerm?: Node;
    omitSourceTerm?: Node;
    hilitedNonAlignedAtSource?: Map<Rdf.Iri, List<Rdf.Iri>>;
    hilitedParentsAtSource?: Map<Rdf.Iri, List<Rdf.Iri>>;
    hilitedParentsAtTarget?: Map<Rdf.Iri, List<Rdf.Iri>>;
    searchingForNonAlignedFlag?: boolean;
    refreshingDBFlag?: boolean;

    sortSourceList?: 'asc' | 'desc';
    sortTargetList?: 'asc' | 'desc';

    sourceGraph?: AlignedGraphProps;
    targetGraph?: AlignedGraphProps;
    // sourceGraphPrefix?: string;
    // targetGraphPrefix?: string;
    sourceQueries?: TreeProps;
    targetQueries?: TreeProps;
    sourceGraphSelectorState?: GraphSelectorState;
    targetGraphSelectorState?: GraphSelectorState;

    nextSourceGraph?: AlignedGraphProps;
    nextTargetGraph?: AlignedGraphProps;

    hierarchyRelations?: { source: string, target: string };//selected by users to be used in sparql
    hierarchyRelationsOptions?: { source: string[], target: string[] };//used for proposing, to be selected as hierarchyRelations???

    //next for viewing
    viewSourceSelection?: List<Rdf.Iri>;
    viewSourceTerm?: List<Rdf.Iri>; //List<string>;
    viewTargetSelection?: List<Rdf.Iri>;
    viewTargetTerm?: List<Rdf.Iri>; //List<string>;
    selectedAlignmentSource?: Map<string, string>; //any //Map<Rdf.Iri, string>
    selectedAlignmentTarget?: Map<string, string>; //any //Map<Rdf.Iri, string>

}


export class TermAlignmentEdit extends Component<Props, State> {
    private alignmentNG: Kefir.Property<Rdf.Iri>;
    private targetTree: SemanticTree;
    private targetForest: KeyedForest<Node>;
    private sourceForest: KeyedForest<Node>;
    private cachedSourceTermsFlagged: Map<Rdf.Iri, Set<Rdf.Iri>> = new Map<Rdf.Iri, Set<Rdf.Iri>>();
    private cachedTargetTermsFlagged: Map<Rdf.Iri, Set<Rdf.Iri>> = new Map<Rdf.Iri, Set<Rdf.Iri>>();
    private iBroader: Relation = this.props.broaderAlignmentRelation;

    private cachedTermsToBeRemovedFromAlignmentGraph = new Array<Rdf.Iri>();//NEW


    constructor(props: Props) {
        super(props);
        this.state = {
            alignment: new Alignment({
                alignedSourceTermsTracker: undefined,
                alignedTargetTermsMap: undefined,
                alignedSourceTermsMap: undefined,
            }),
            selection: undefined,
            //required
            sourceGraphSelectorState: { graphList: undefined, offset: (this.props.graphSelectorLimit ? 0 : undefined) },
            targetGraphSelectorState: { graphList: undefined, offset: (this.props.graphSelectorLimit ? 0 : undefined) },

            //hierarchyRelations: { source: this.props.parentshipRelation, target: this.props.parentshipRelation },
            hierarchyRelations: { source: undefined, target: undefined },
        };
    }

    private setStateFunc = (state: State) => {
        //console.log("/////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\" + "@Alignment_Edit state change? " + (this.state == state));
        const prevState = this.state;
        const nextState = state;
        //this.debugState(prevState, nextState);
        this.setState(state);
    }


    //Called when a new hierarchy value is selected for presentation
    private newHierarchyRelationState = (hierarchyRelations: { source: string, target: string }) => {
        //console.log("newHierarchyRelationState");
        this.alignmentNG.onValue(NGIri => {
            const sourceQueries = this.constructSourceQueries(this.sourceGraphIri(), (hierarchyRelations ? hierarchyRelations.source : undefined));
            const targetQueries = this.constructTargetQueries(NGIri, this.sourceGraphIri(), this.targetGraphIri(), (hierarchyRelations ? hierarchyRelations.target : undefined));
            this.setStateFunc({
                alignment: this.state.alignment,
                //draggedTerm: undefined,
                selection: this.state.selection,

                sourceQueries: sourceQueries,
                targetQueries: targetQueries,

                hierarchyRelations: { source: hierarchyRelations.source, target: hierarchyRelations.target },
            })
        })
    }
    //Called when a new pair is set as the next to be loaded
    private nextAlignmentState = (sourceNG: Rdf.Iri, targetNG: Rdf.Iri) => {
        //console.log("nextAlignmentState");
        this.setStateFunc({
            alignment: this.state.alignment,
            selection: this.state.selection,
            nextSourceGraph: sourceNG ? { iri: sourceNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(sourceNG) : undefined) } : this.state.nextSourceGraph,
            nextTargetGraph: targetNG ? { iri: targetNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(targetNG) : undefined) } : this.state.nextTargetGraph,

            hierarchyRelations: this.state.hierarchyRelations,

        });
    }
    //Called when a new pair or alignmentID is loaded
    private newAlignmentState = (sourceNG: Rdf.Iri, targetNG: Rdf.Iri, alignmentNG: Rdf.Iri, hierarchyRelations?: { source: string, target: string }) => {
        // console.log("newAlignmentState");
        // console.log(sourceNG);
        // console.log(targetNG);
        // console.log(alignmentNG);
        // console.log(hierarchyRelations);
        // console.log(this.state.hierarchyRelations);

        //const allowed = (!this.waitToChooseSource && !this.waitToChooseTarget);

        //create/load a new alignment
        if (sourceNG && targetNG) {
            //this.resetWaitToChoose();

            this.alignmentNG = AlignmentRDF.setNG(sourceNG, targetNG, alignmentNG, this.props.user);
            //ANASTASIA COMMENT OUT BY 05.March.2020
            // if (this.alignmentNG) {
            //     this.setStateFunc(_.assign(this.state, { "loadingNewAlignment": true }));
            // }

            const sourceHROptions = AlignmentRDF.getHierarchyOptions(sourceNG, ...this.props.hierarchyRelationOptions);
            const targetHROptions = AlignmentRDF.getHierarchyOptions(targetNG, ...this.props.hierarchyRelationOptions);
            const hrOps_default_dummy = this.props.hierarchyRelationOptions[0]; //when no hierarchy relation in the schema (flat), just use any default-dummy value

            this.alignmentNG.onValue(NGIri => {

                // this.loadAlignment(NGIri);

                const getAllTargetAlignments: Kefir.Property<TargetTermAlignmentType[]> = AlignmentRDF.getAllTargetAlignments(NGIri, sourceNG, targetNG);
                const getAllSourceAlignments: Kefir.Property<SourceTermAlignmentType[]> = AlignmentRDF.getAllSourceAlignments(NGIri, sourceNG);


                //A. Load sourceHR options
                sourceHROptions.onValue(resS => {
                    let sourceHROps: string[] = resS ? resS.map(opt => opt["option"].value.trim()) : [];

                    //B. Load targetHR options
                    targetHROptions.onValue(resT => {
                        let targetHROps = resT ? resT.map(opt => opt["option"].value.trim()) : [];

                        //C. Load Target Alignments
                        getAllTargetAlignments.onValue(result => {
                            const newAlignment = new Alignment({
                                alignedSourceTermsTracker: undefined,
                                alignedTargetTermsMap: undefined,
                                alignedSourceTermsMap: undefined,
                            });
                            if (result) {
                                result.forEach(item => { //item:TargetTermAlignmentType
                                    const added: boolean = newAlignment.addAlignment(item.source, item.sourceLabel, item.relation, item.target, item.targetLabel);
                                    //Caching target flags
                                    if (!this.cachedTargetTermsFlagged.has(item.target)) {
                                        this.cachedTargetTermsFlagged.set(item.target, new Set());//init
                                        /*if (this.state.targetGraph)*/ this.recursivelyGetParents([targetNG], item.target, item.target, targetHROps[0], this.cachedTargetTermsFlagged);
                                    }
                                });
                            }

                            //D. Load Source Alignments
                            getAllSourceAlignments.onValue(result => {
                                if (result) {
                                    result.forEach(item => { //item:SourceTermAlignmentType
                                        newAlignment.trackSourceTermAlignment(item.source, true); //Correct
                                        //Caching source flags
                                        if (newAlignment.isSourceTermExplicitlyAligned(item.source) && !this.cachedSourceTermsFlagged.has(item.source)) {
                                            this.cachedSourceTermsFlagged.set(item.source, new Set());//init
                                            /*if (this.state.sourceGraph)*/ this.recursivelyGetParents([sourceNG], item.source, item.source, sourceHROps[0], this.cachedSourceTermsFlagged);
                                        }
                                    });
                                }

                                const sourceQueries = this.constructSourceQueries(sourceNG, (sourceHROps.length > 0 ? sourceHROps[0] : hrOps_default_dummy));
                                const targetQueries = this.constructTargetQueries(NGIri, sourceNG, targetNG, (targetHROps.length > 0 ? targetHROps[0] : hrOps_default_dummy));

                                this.setStateFunc({
                                    alignment: newAlignment,
                                    //draggedTerm: undefined,
                                    selection: undefined,
                                    selectionMode: new SinglePartialSubtree<Node>(),
                                    sourceGraph: { iri: sourceNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(sourceNG) : undefined) },
                                    targetGraph: { iri: targetNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(targetNG) : undefined) },

                                    nextSourceGraph: { iri: sourceNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(sourceNG) : undefined) },
                                    nextTargetGraph: { iri: targetNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(targetNG) : undefined) },

                                    hilitedNonAlignedAtSource: undefined,
                                    hilitedParentsAtSource: undefined,
                                    hilitedParentsAtTarget: undefined,
                                    searchSourceSelection: undefined,
                                    searchTargetSelection: undefined,

                                    sourceQueries: sourceQueries,
                                    targetQueries: targetQueries,

                                    //hierarchyRelations: { source: hierarchyRelations ? hierarchyRelations.source : sourceHROps[0], target: hierarchyRelations ? hierarchyRelations.target : (targetHROps[0]) },

                                    hierarchyRelations: { source: sourceHROps[0], target: targetHROps[0] },
                                    hierarchyRelationsOptions: { source: sourceHROps, target: targetHROps },

                                    sourceGraphSelectorState: { graphList: undefined, offset: (this.props.graphSelectorLimit ? 0 : undefined) },
                                    targetGraphSelectorState: { graphList: undefined, offset: (this.props.graphSelectorLimit ? 0 : undefined) },

                                    viewSourceSelection: undefined,
                                    viewSourceTerm: undefined,
                                    viewTargetSelection: undefined,
                                    viewTargetTerm: undefined,
                                    selectedAlignmentSource: undefined,
                                    selectedAlignmentTarget: undefined,

                                    loadingNewAlignment: false,
                                });
                            });
                        });
                    });
                })
            });

        } else if (!sourceNG || !targetNG) { //Store in the State either NG value until both values are available
            this.alignmentNG = undefined;
            this.setStateFunc({
                // alignment: new Alignment({
                //     alignedSourceTermsTracker: undefined,
                //     alignedTargetTermsMap: undefined,
                // }),
                //draggedTerm: undefined,
                alignment: this.state.alignment,//NEW
                selection: undefined,
                selectionMode: new SinglePartialSubtree<Node>(),
                sourceGraph: sourceNG ? { iri: sourceNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(sourceNG) : undefined) } : this.state.sourceGraph,
                targetGraph: targetNG ? { iri: targetNG, prefix: (this.props.get_terminology_prefices ? this.props.get_terminology_prefices(targetNG) : undefined) } : this.state.targetGraph,

                hierarchyRelations: this.state.hierarchyRelations,

            })
        }
    }

    //Called on add/remove a correspondence
    updateAlignmentState = (alignment: Alignment, clearVisualization?: boolean): void => {
        //console.log("updateAlignmentState");
        this.setStateFunc({
            alignment: alignment,
            //NEW draggedTerm: this.state.draggedTerm,
            selection: this.state.selection,

            hierarchyRelations: this.state.hierarchyRelations,

            viewSourceSelection: clearVisualization ? undefined : this.state.viewSourceSelection,
            viewSourceTerm: clearVisualization ? undefined : this.state.viewSourceTerm,
            viewTargetSelection: clearVisualization ? undefined : this.state.viewTargetSelection,
            viewTargetTerm: clearVisualization ? undefined : this.state.viewTargetTerm,
            selectedAlignmentSource: clearVisualization ? undefined : this.state.selectedAlignmentSource,
            selectedAlignmentTarget: clearVisualization ? undefined : this.state.selectedAlignmentTarget,
        });
    }

    //Called when on componentWillReceiveProps there is already a current alignment loaded but no new alignmentID exists in the nextProps. That means that the Editor must be reset.
    private cleanAlignmentState = () => {
        //console.log("cleanAlignmentState");
        this.setStateFunc({
            alignment: new Alignment({
                alignedSourceTermsTracker: undefined,
                alignedTargetTermsMap: undefined,
                alignedSourceTermsMap: undefined,
            }),
            //draggedTerm: undefined,
            selection: undefined,
            selectionMode: new SinglePartialSubtree<Node>(),
            sourceGraph: undefined,
            targetGraph: undefined,

            hilitedNonAlignedAtSource: undefined,
            hilitedParentsAtSource: undefined,
            hilitedParentsAtTarget: undefined,
            searchSourceSelection: undefined,
            searchTargetSelection: undefined,

            sourceQueries: undefined,
            targetQueries: undefined,

            sourceGraphSelectorState: { graphList: undefined, offset: (this.props.graphSelectorLimit ? 0 : undefined) },
            targetGraphSelectorState: { graphList: undefined, offset: (this.props.graphSelectorLimit ? 0 : undefined) },

            viewSourceSelection: undefined,
            viewSourceTerm: undefined,
            viewTargetSelection: undefined,
            viewTargetTerm: undefined,
        });

    }


    private initVars() {
        this.alignmentNG = undefined;
        this.targetTree = undefined;
        this.targetForest = undefined;
        this.sourceForest = undefined;
        this.cachedSourceTermsFlagged = new Map<Rdf.Iri, Set<Rdf.Iri>>();
        this.cachedTargetTermsFlagged = new Map<Rdf.Iri, Set<Rdf.Iri>>();
        this.cachedTermsToBeRemovedFromAlignmentGraph = new Array<Rdf.Iri>();
    }

    componentWillMount() {
        //console.log("componentWillMount @Edit page");
    }

    componentDidMount() {
        //console.log("componentDidMount @Edit page");
    }

    componentWillReceiveProps(nextProps) {//Handling the props coming from the parent component
        //console.log("componentWillReceiveProps @Edit page");
        if (nextProps == this.props) {
            //console.log("same Props");
            return;
        }

        const newLoadAlignmentID_condition: boolean = (nextProps.loadAlignmentID && ("" + nextProps.loadAlignmentID != "" + this.props.loadAlignmentID));
        const cleanAlignment_condition: boolean = (!nextProps.loadAlignmentID && this.props.loadAlignmentID ? true : false);

        if (newLoadAlignmentID_condition) {
            //ANASTASIA ADDED BY 05.March.2020.
            this.setStateFunc(_.assign(this.state, { "loadingNewAlignment": true }));
            //ANASTASIA MOVED CODE TO componentDidUpdate() BY 05.March.2020.
            // AlignmentRDF.getSourceTargetGraphsByAlignment(nextProps.loadAlignmentID)
            //     .onValue(res => {
            //         if (res[0] && res[0]["sourceNG"] && res[0]["targetNG"]) {
            //             //console.log("1. New Alignment ID is loading...");
            //             this.initVars();
            //             this.newAlignmentState(res[0]["sourceNG"], res[0]["targetNG"], nextProps.loadAlignmentID);
            //         }
            //     })
            //     .onError((e: Error) => {
            //         console.log("Error preparing new alignment " + nextProps.loadAlignmentID);
            //         console.log(e.message);
            //     });
        }
        //clean all
        else if (cleanAlignment_condition) {
            //console.log("2. Clear all");
            this.initVars();
            this.cleanAlignmentState();
        }
        else {
            //if (this.props.loadAlignmentID && !this.spinner_onRefreshingDB()) this.refreshDB();
            //console.log("initCond3");
            //nothing
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        //console.log("shouldComponentUpdate @Edit page");
        if (!this.state.draggedTerm && nextState.draggedTerm != undefined) return false;

        //console.log("true");
        return true;
    }

    /*The Edit component operates independently its parent, except for the case where the 'loadAlignmentID' is set at parent.*/
    componentDidUpdate(prevProps, prevState) {//When the state or the props change
        //console.log("componentDidUpdate @Edit page");


        //ANASTASIA MOVED CODE FROM componentWillReceiveProps() BY 05.March.2020. 
        if (this.state.loadingNewAlignment) {
            const props = this.props;
            AlignmentRDF.getSourceTargetGraphsByAlignment(props.loadAlignmentID)
                .onValue(res => {
                    if (res[0] && res[0]["sourceNG"] && res[0]["targetNG"]) {
                        //console.log("1. New Alignment ID is loading...");
                        this.initVars();
                        this.newAlignmentState(res[0]["sourceNG"], res[0]["targetNG"], props.loadAlignmentID);
                    }
                })
                .onError((e: Error) => {
                    console.log("Error preparing new alignment " + props.loadAlignmentID);
                    console.log(e.message);
                });
            return;
        }


        const alignmentGraphsGhanged_condition: boolean = (this.state.sourceGraph != prevState.sourceGraph && this.state.targetGraph != prevState.targetGraph);
        if (alignmentGraphsGhanged_condition) {
            //console.log("3. New alignment: the source or target graph is changed");
            if (this.alignmentNG) (this.alignmentNG.onValue(NGIri => this.props.setCurrentAlignmentNG(NGIri)));
        }
        //Scroll source tree
        if (this.state.searchSourceSelection && this.state.searchSourceSelection.nodes.size > 0 && this.state.searchSourceSelection != prevState.searchSourceSelection) {
            const keys = this.state.searchSourceSelection.nodes.keys();
            let destinIri = keys.next();                                //gets the dummy root-node
            if (destinIri && !destinIri.done) destinIri = keys.next();  //gets the selected root-node
            if (destinIri && destinIri.value) {
                const domNode = findDOMNode(this.refs.sourceZone);
                const scrollToSrcElement = domNode.querySelector("div.sourceSelector div.SemanticTreeInput--tree");
                const scrollToDestinElement = domNode.querySelector(`div.sourceSelector span[title='${destinIri.value}']`);
                if (!scrollToSrcElement || !scrollToDestinElement) return;
                scrollToSrcElement.scrollTop = (<HTMLElement>scrollToDestinElement).offsetTop;
                //(<HTMLElement>scrollToSrcElement).setAttribute("class", `animate({ scrollTop: ${(<HTMLElement>scrollToDestinElement).offsetTop} }, "fast")`);
            }
        }
        //Scroll target tree
        if (this.state.searchTargetSelection && this.state.searchTargetSelection.nodes.size > 0 && this.state.searchTargetSelection != prevState.searchTargetSelection) {
            const keys = this.state.searchTargetSelection.nodes.keys();
            let destinIri = keys.next();                                //gets the dummy root-node
            if (destinIri && !destinIri.done) destinIri = keys.next();  //gets the selected root-node
            if (destinIri && destinIri.value) {
                const domNode = findDOMNode(this.refs.targetZone);
                const scrollToSrcElement = domNode.querySelector("div.targetSelector div.SemanticTreeInput--tree");
                const scrollToDestinElement = domNode.querySelector(`div.targetSelector span[title='${destinIri.value}']`);
                if (!scrollToSrcElement || !scrollToDestinElement) return;
                scrollToSrcElement.scrollTop = (<HTMLElement>scrollToDestinElement).offsetTop;
                //(<HTMLElement>scrollToSrcElement).setAttribute("class", `animate({ scrollTop: ${(<HTMLElement>scrollToDestinElement).offsetTop} }, "fast")`);
            }
        }

        // if (prevState.sourceHierarchyRelation && prevState.sourceHierarchyRelation != this.state.sourceHierarchyRelation)
        //     console.log(this.state.sourceQueries.rootsQuery);

    }

    private recursivelyGetParents(ngList: Rdf.Iri[], keyTerm, term, hierarchyRelation: string, cachedTermsFlagged: Map<Rdf.Iri, Set<Rdf.Iri>>) {
        AlignmentRDF.getDirectParents(ngList, term, hierarchyRelation).onValue(res => {
            res.forEach(r => {
                if (r.parent) {
                    cachedTermsFlagged.get(keyTerm).add(r.parent);
                    this.recursivelyGetParents(ngList, keyTerm, r.parent, hierarchyRelation, cachedTermsFlagged);
                }
            });
        })
    }


    // //At source queries we remove all the /*...*/ patterns. These patterns are used only for the target queries.
    constructSourceQueries(sourceNG: Rdf.Iri, sourceHierarchyRelation: string): { rootsQuery, childrenQuery, parentsQuery, searchQuery } {

        return QueriesConfig.constructSourceQueries(this.props.queries, this.props.prefices,
            this.props.typeRelation, this.props.typesRootQuery, this.props.typesParentQuery, this.props.typesChildrenQuery, this.props.typesSearchQuery,
            sourceHierarchyRelation, this.props.labelRelation,
            sourceNG);
    }

    constructTargetQueries(NGIri: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, targetHierarchyRelation: string): { rootsQuery, childrenQuery, parentsQuery, searchQuery } {

        return QueriesConfig.constructTargetQueries(NGIri, this.props.queries, this.props.prefices,
            this.props.typeRelation, this.props.typesRootQuery, this.props.typesParentQuery, this.props.typesChildrenQuery, this.props.typesSearchQuery,
            targetHierarchyRelation, this.props.labelRelation,
            this.props.exactMatchAlignmentRelation.iri, this.props.closeMatchAlignmentRelation.iri, this.props.relatedMatchAlignmentRelation.iri, this.props.broadMatchAlignmentRelation.iri, this.props.broaderAlignmentRelation.iri,
            sourceNG, targetNG);
    }

    //creates a new alignment graph with the new versions of source and target terminologies
    upgradeAlignment = () => {
        this.props.currentAlignmentSyncNotificationFunc();
        const sourceGraphIri = this.state.sourceGraph.iri;
        const targetGraphIri = this.state.targetGraph.iri;
        const s = this.props.getNewVersionOfSynchronizedGraph(sourceGraphIri);
        const t = this.props.getNewVersionOfSynchronizedGraph(targetGraphIri);
        const s1 = (s && s.get(sourceGraphIri.value)) ? s.get(sourceGraphIri.value) : this.state.sourceGraph.iri;
        const t1 = (t && t.get(targetGraphIri.value)) ? t.get(targetGraphIri.value) : this.state.targetGraph.iri;
        AlignmentRDF.duplicateAlignmentGraph(this.props.loadAlignmentID, s1, t1, undefined,
            ((): Rdf.Iri[] => {
                return this.cachedTermsToBeRemovedFromAlignmentGraph
            }).bind(this),
            this.props.user,
            this.props.setCurrentAlignmentNG.bind(this),
            //this.newAlignmentState.bind(this, s1, t1) //it works too!
        )
    }


    public render() {
        //console.log("render() @Edit page");

        return D.div({},
            this.renderAlignmentsZone(),
            (this.state.focusTargetTerm ? this.createRelationSelectionElement(this.state.draggedTerm, this.state.focusTargetTerm) : undefined),

            (this.props.currentAlignmentSyncNotificationFunc) ?
                OverlayDialogs.create_yes_no_OverlayDialog(
                    "syncGraph_OverlayDialog",
                    "Upgrade current alignment with the new terminology version(s)",
                    "Are you sure you want to upgrade current alignment graph with the new terminology version(s)?",
                    this.upgradeAlignment,//closes dialog
                    // this.props.currentAlignmentSyncNotificationFunc,//closes dialog
                    //  this.props.currentAlignmentSyncNotificationFunc //closes dialog
                ) : undefined,

        );
    }


    //Put here all the conditions that cause the "Spinner" to appear
    private spinner_onDropAlignedTerm = (node) => this.state.focusTargetTerm && this.state.focusTargetTerm == node;//while true, show spinner
    private spinner_onSearchingForNonAligned = () => this.state.searchingForNonAlignedFlag;
    private spinner_onRefreshingDB = () => this.state.refreshingDBFlag;
    private spinner_isLoadingAlignment = () => { /*console.log(this.state.loadingNewAlignment);*/ return Boolean(this.state.loadingNewAlignment); }

    private renderAlignmentsZone() {
        //let enableNextAlignment_condition: boolean = Boolean(this.state.nextSourceGraph && this.state.nextTargetGraph && this.nextSourceGraphIri() && this.nextTargetGraphIri());
        let enableNextAlignment_condition: boolean = Boolean(this.nextSourceGraphIri() && this.nextTargetGraphIri());
        enableNextAlignment_condition = enableNextAlignment_condition &&
            ((this.sourceGraphIri() ? this.nextSourceGraphIri().value != this.sourceGraphIri().value : true) ||
                (this.targetGraphIri() ? this.nextTargetGraphIri().value != this.targetGraphIri().value : true));
        enableNextAlignment_condition = enableNextAlignment_condition && this.nextSourceGraphIri().value != this.nextTargetGraphIri().value;

        const alignButtonClickFunc = (enableNextAlignment_condition) ? () => this.newAlignmentState(this.nextSourceGraphIri(), this.nextTargetGraphIri(), undefined) : undefined;
        const refreshButtonClickFunc = this.spinner_onRefreshingDB() ? undefined : () => this.refreshDB();

        return UI.layout(this.refs, this.state.sourceGraph, this.state.targetGraph,
            this.createGraphsDropdown("source"), this.createGraphsDropdown("target"), // DEL this.state.targetQueries,
            this.createSourceSemanticTreeInput(), this.createSourceSemanticTree(), this.displaySourceAlignments(),
            this.createTargetSemanticTreeInput(), this.createTargetSemanticTree(), this.displayTargetAlignments(),
            this.createNonAlignedSourceTermsButton(), this.createHierarchySelector("source"), this.createHierarchySelector("target"),
            alignButtonClickFunc, refreshButtonClickFunc, this.spinner_isLoadingAlignment,
            { state: this.state.sortSourceList, func: this.sourceListSortFunc }, { state: this.state.sortTargetList, func: this.targetListSortFunc },
        );
    }
    private sourceListSortFunc = () => {
        let order: 'asc' | 'desc' = (!this.state.sortSourceList ? 'asc' : (this.state.sortSourceList == 'asc' ? 'desc' : 'asc'));
        this.updateSourceListSort(order);
    }
    private targetListSortFunc = () => {
        let order: 'asc' | 'desc' = (!this.state.sortTargetList ? 'asc' : (this.state.sortTargetList == 'asc' ? 'desc' : 'asc'));
        this.updateTargetListSort(order);
    }

    private refreshDB(currAlignment?) {
        this.updateWaitForRefreshDB(true);
        this.alignmentNG.onValue(NGIri =>
            this.recursivelyRemoveOrphans(NGIri, this.sourceGraphIri(), this.targetGraphIri(), currAlignment)
        );
    }

    private createHierarchySelector(id: "source" | "target") {
        if (!this.alignmentNG) return undefined;
        let setStateFunc;
        let title;
        let options;
        if (id === "source") {
            setStateFunc = (key) => this.newHierarchyRelationState({ source: key, target: this.hierRelTarget() });//target: (this.state.hierarchyRelations ? this.hierRelTarget() : undefined)
            title = this.hierRelSource();//(this.state.hierarchyRelations && this.hierRelSource()) ? `${this.hierRelSource()}` : undefined;
            options = this.hierRelSourceOptions();
        } else if (id === "target") {
            setStateFunc = (key) => this.newHierarchyRelationState({ source: this.hierRelSource(), target: key });//source: (this.state.hierarchyRelations ? this.hierRelSource() : undefined)
            title = this.hierRelTarget();//(this.state.hierarchyRelations && this.hierRelTarget()) ? `${this.hierRelTarget()}` : undefined;
            options = this.hierRelTargetOptions();
        }
        return UI.createHierarchySelector(id, options, setStateFunc, title);
    }

    private createGraphsDropdown(id: "source" | "target") {
        if (id === "source") {
            const nextAlignmentState = (key) => this.nextAlignmentState(Rdf.fullIri("<" + key + ">"), undefined);
            const retrieveSourceGraphs = (offsetDir: number) => this.retrieveGraphs(id, offsetDir, this.state.sourceGraphSelectorState);
            const nextGraph = this.state.nextSourceGraph ? this.state.nextSourceGraph : this.state.sourceGraph;
            return UI.createGraphsDropdown(nextGraph, this.state.sourceGraphSelectorState, retrieveSourceGraphs, nextAlignmentState);
        } else if (id === "target") {
            const nextAlignmentState = (key) => this.nextAlignmentState(undefined, Rdf.fullIri("<" + key + ">"));
            const retrieveTargetGraphs = (offsetDir: number) => this.retrieveGraphs(id, offsetDir, this.state.targetGraphSelectorState);
            const nextGraph = this.state.nextTargetGraph ? this.state.nextTargetGraph : this.state.targetGraph;
            return UI.createGraphsDropdown(nextGraph, this.state.targetGraphSelectorState, retrieveTargetGraphs, nextAlignmentState);
        }
    }

    private navigateGraphListButton = (key, title, func, ...arg) => createElement(Button, {
        key: key + "_but",
        title: title,
        bsSize: "small",
        bsStyle: 'default',
        className: "full-width",
        onClick: func.bind(this, ...arg),
    }, title);

    private retrieveGraphs = (id: "source" | "target", offsetDir: number, graphSelectorState: GraphSelectorState) => {//direction of offset: offsetDir= 1, 0, -1
        const limit = this.props.graphSelectorLimit;
        let newOffset = (graphSelectorState.offset != undefined ? (graphSelectorState.offset + offsetDir * limit) : undefined);
        newOffset = (newOffset < 0 ? 0 : newOffset);
        const graphSelector = AlignmentRDF.getSchemeGraphs(limit, newOffset);
        graphSelector.onValue(res => {
            const listItems = res.reduce((components, item) => {
                components.push(createElement(MenuItem, { eventKey: item["graph"].value }, item["graph"].value));
                return components;
            },
                //add the "previous" button
                (newOffset ? [this.navigateGraphListButton("previous", "previous items", this.retrieveGraphs, id, -1, graphSelectorState)] : [])
            );
            //add the "next" button
            if (res.length >= limit)
                listItems.push(this.navigateGraphListButton("next", "next items", this.retrieveGraphs, id, 1, graphSelectorState));

            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                sourceGraphSelectorState: (id === "source" ? { graphList: listItems, offset: newOffset } : this.state.sourceGraphSelectorState),
                targetGraphSelectorState: (id === "target" ? { graphList: listItems, offset: newOffset } : this.state.targetGraphSelectorState),
            })
        })
            .onError((e: Error) => {
                console.log("Error");
                console.log(e.message);
            });
    }

    private createSourceSemanticTree() {
        let queriesLoaded = false;
        if (this.state.sourceQueries)
            queriesLoaded = Boolean(this.state.sourceQueries.rootsQuery &&
                this.state.sourceQueries.childrenQuery &&
                this.state.sourceQueries.parentsQuery &&
                this.state.sourceQueries.searchQuery);

        if (queriesLoaded) {
            return semanticTree({
                className: "sourceSelector",
                rootsQuery: this.state.sourceQueries.rootsQuery,
                childrenQuery: this.state.sourceQueries.childrenQuery,
                parentsQuery: this.state.sourceQueries.parentsQuery,
                renderItem: this.renderSourceTerm,
                getForest: (forest: KeyedForest<Node>) => this.sourceForest = forest,
                onSelectionChanged: (selection) => {

                    this.setStateFunc({
                        alignment: this.state.alignment,
                        //NEW draggedTerm: this.state.draggedTerm,
                        selection: selection,
                    });
                },
                requestMoreChildren: node => {
                    return Kefir.constant(List());
                },
                selection: this.state.selection,
                selectionMode: this.state.selectionMode
            })
        }
    }

    private createSourceSemanticTreeInput() {
        let queriesLoaded = false;
        if (this.state.sourceQueries)
            queriesLoaded = Boolean(this.state.sourceQueries.rootsQuery &&
                this.state.sourceQueries.childrenQuery &&
                this.state.sourceQueries.parentsQuery &&
                this.state.sourceQueries.searchQuery);

        if (queriesLoaded) {

            // console.log("createSourceSemanticTreeInput");
            // console.log(this.state.sourceQueries.rootsQuery);
            // console.log(this.state.sourceQueries.childrenQuery);
            // console.log(this.state.sourceQueries.parentsQuery);
            // console.log(this.state.sourceQueries.searchQuery);

            return createElement(semanticTreeInput, {
                key: 1,
                rootsQuery: this.state.sourceQueries.rootsQuery,
                childrenQuery: this.state.sourceQueries.childrenQuery,
                parentsQuery: this.state.sourceQueries.parentsQuery,
                searchQuery: this.state.sourceQueries.searchQuery,
                multipleSelection: true,
                initialSelection: [],
                onSelectionChanged: (selection) => {
                    this.setStateFunc({
                        alignment: this.state.alignment,
                        draggedTerm: this.state.draggedTerm, //required here
                        selection: this.state.selection,
                        //showDialog: this.state.showDialog,
                        searchSourceSelection: selection,
                        searchTargetSelection: this.state.searchTargetSelection
                    });
                },
                droppable: {
                    query: "ASK { ?value rdf:type  ?any }"
                },
            })
        }
    }

    private createTargetSemanticTree() {
        let queriesLoaded = false;
        if (this.state.targetQueries)
            queriesLoaded = Boolean(this.state.targetQueries.rootsQuery &&
                this.state.targetQueries.childrenQuery &&
                this.state.targetQueries.parentsQuery &&
                this.state.targetQueries.searchQuery);


        if (queriesLoaded) {

            return semanticTree({
                ref: (tree) => { this.targetTree = tree },
                className: "targetSelector",
                rootsQuery: this.state.targetQueries.rootsQuery,
                childrenQuery: this.state.targetQueries.childrenQuery,
                parentsQuery: this.state.targetQueries.parentsQuery,
                renderItem: this.renderTargetTerm,
                getForest: (forest: KeyedForest<Node>) => this.targetForest = forest,
                requestMoreChildren: node => {
                    return Kefir.constant(List());
                },
                onSelectionChanged: () => { },
                selection: undefined,
                selectionMode: new SinglePartialSubtree<Node>(),
                hideCheckboxes: true,
            })
        }
    }


    private createTargetSemanticTreeInput() {
        let queriesLoaded = false;
        if (this.state.targetQueries)
            queriesLoaded = Boolean(this.state.targetQueries.rootsQuery &&
                this.state.targetQueries.childrenQuery &&
                this.state.targetQueries.parentsQuery &&
                this.state.targetQueries.searchQuery);

        if (queriesLoaded) {

            return createElement(semanticTreeInput, {
                key: 1,
                rootsQuery: this.state.targetQueries.rootsQuery,
                childrenQuery: this.state.targetQueries.childrenQuery,
                parentsQuery: this.state.targetQueries.parentsQuery,
                searchQuery: this.state.targetQueries.searchQuery,
                multipleSelection: true,
                initialSelection: [],
                onSelectionChanged: (selection) => {

                    this.setStateFunc({
                        alignment: this.state.alignment,
                        draggedTerm: this.state.draggedTerm, //required here
                        selection: this.state.selection,
                        //showDialog: this.state.showDialog,
                        searchSourceSelection: this.state.searchSourceSelection,
                        searchTargetSelection: selection
                    });
                },
                droppable: {
                    query: "ASK { ?value rdf:type  ?any }"
                },
            })
        }
    }


    private checkTermSynchronized(g1: AlignedGraphProps, hierRelation: string,
        getSynchronizedGraphs: (ngIRI?: Rdf.Iri) => Map<string, Rdf.Iri>,
        term: Rdf.Iri, stateUpdateFunc: ({ sync: boolean, reason: string }) => void) {

        if (!g1 || !hierRelation || !term) {
            // console.log(g1);
            // console.log(hierRelation)
            // console.log(term)
            return true;
        }

        if (!getSynchronizedGraphs) return true;
        let g2: Map<string, Rdf.Iri> = undefined;
        g2 = getSynchronizedGraphs(g1.iri);

        if (!g2 || g2.size == 0)
            return true;

        const g2Iri: Rdf.Iri = (g2.has(g1.iri.value) && g2.get(g1.iri.value)) ? g2.get(g1.iri.value) : undefined;
        if (!g2Iri) return true;

        const parentsChangedStateUpdate = (term: Rdf.Iri) => stateUpdateFunc({ sync: true, reason: "Changed parents for this term" });
        const termNotFoundStateUpdate = (term: Rdf.Iri) => {
            stateUpdateFunc({ sync: true, reason: "Term was not found in the new graph." });
            this.cachedTermsToBeRemovedFromAlignmentGraph.push(term);
        }

        AlignmentRDF.isTermInNG(g2Iri, term).onValue(res0 => {
            if (!res0) {
                termNotFoundStateUpdate(term);
                return;
            }

            this.recursivelyCompareParents(g1.iri, g2Iri, term, hierRelation, stateUpdateFunc);

            // AlignmentRDF.getDirectParents([g1.iri], term, hierRelation)
            //     .onValue(res1 => {
            //         if (!res1) return;
            //         // res1.forEach(tuple1 => {
            //         //     const parent1 = tuple1["parent"];
            //         //     const parentLabel1 = tuple1["parentLabel"];
            //         AlignmentRDF.getDirectParents([g2Iri], term, hierRelation)
            //             .onValue(res2 => {
            //                 if (!res2) { //|| res2.length
            //                     termNotFoundStateUpdate(term)
            //                     return;
            //                 }
            //                 if (res2.length != res1.length) {
            //                     //console.log("Num of parents has changed")
            //                     parentsChangedStateUpdate(term)
            //                 } else {
            //                     const sameParents = res2.find(tuple2 => {
            //                         const parent2 = tuple2["parent"] ? tuple2["parent"]["value"] : undefined;
            //                         const parentLabel2 = tuple2["parentLabel"];

            //                         const compareParents = res1.find(tuple1 => {
            //                             const parent1 = tuple1["parent"] ? tuple1["parent"]["value"] : undefined;
            //                             const parentLabel1 = tuple1["parentLabel"];
            //                             return (parent2 == parent1);
            //                         })
            //                         //if (!compareParents) console.log(term, "has changed");
            //                         return compareParents;

            //                     })
            //                     if (!sameParents) parentsChangedStateUpdate(term);
            //                 }
            //             })
            //         // })
            //     })
        })
        return false;
    }

    recursivelyCompareParents(g1: Rdf.Iri, g2: Rdf.Iri, term: Rdf.Iri, hierRelation: string,
        stateUpdateFunc: ({ sync: boolean, reason: string }) => void) {

        const parentsChangedStateUpdate = (term: Rdf.Iri) => stateUpdateFunc({ sync: true, reason: "Changed parents for this term" });
        const termNotFoundStateUpdate = (term: Rdf.Iri) => {
            stateUpdateFunc({ sync: true, reason: "Term was not found in the new graph." });
            this.cachedTermsToBeRemovedFromAlignmentGraph.push(term);
        }
        if (!term) return;
        AlignmentRDF.getDirectParents([g1], term, hierRelation)
            .onValue(res1 => {
                if (!res1 || (res1.length == 1 && !res1["parent"])) res1 = undefined;
                // res1.forEach(tuple1 => {
                //     const parent1 = tuple1["parent"];
                //     const parentLabel1 = tuple1["parentLabel"];
                AlignmentRDF.getDirectParents([g2], term, hierRelation)
                    .onValue(res2 => {
                        if (!res2 || (res2.length == 1 && !res2["parent"])) res2 = undefined;

                        //cases
                        if (!res1 && !res2) {
                            //console.log("NO PARENTS in both g1 or g2. So no problem regarding this criterion", term);
                            return;
                        }
                        if ((!res1 && res2) || (res1 && !res2)) {
                            //console.log("NO PARENTS in either g1 or g2, but there are parents in the other", term);
                            parentsChangedStateUpdate(term);
                            return;
                        }
                        if (res1 && res2) {
                            if (res2.length != res1.length) {
                                //console.log("Num of parents has changed", term)
                                parentsChangedStateUpdate(term);
                                return;
                            }
                            else {
                                const sameParents = res2.find(tuple2 => {
                                    const parent2 = tuple2["parent"] ? tuple2["parent"]["value"] : undefined;
                                    const parentLabel2 = tuple2["parentLabel"];

                                    const compareParents = res1.find(tuple1 => {
                                        const parent1 = tuple1["parent"] ? tuple1["parent"]["value"] : undefined;
                                        const parentLabel1 = tuple1["parentLabel"];
                                        return (parent2 == parent1);
                                    })
                                    //if (!compareParents) console.log(term, "has changed");
                                    return compareParents;
                                })
                                if (!sameParents) {
                                    parentsChangedStateUpdate(term)
                                    return;
                                } else {
                                    res1.forEach(tuple1 => {
                                        const parent1 = tuple1["parent"] ? tuple1["parent"]["value"] : undefined;
                                        const parentLabel1 = tuple1["parentLabel"];
                                        this.recursivelyCompareParents(g1, g2, parent1, hierRelation, stateUpdateFunc)
                                    });
                                }
                            }
                        }
                    })
                // })
            })

    }

    private displaySourceAlignments() {//View  
        const sourceMappings: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>> = this.state.alignment.getAlignedSourceTermsMap();
        return createElement(DisplayAlignedTermsComponent,
            {
                mappings: sourceMappings,
                graph: this.state.sourceGraph,
                selectedAlignment: this.state.selectedAlignmentSource,
                iriprop: "sourceIri",
                labelprop: "sourceLabel",
                termStyle: this.getTermHiliteParentStyle,
                hilitedParents: this.state.hilitedParentsAtSource,
                sortList: this.state.sortSourceList,
                onClickTerm: this.onClickAlignedSourceTerm,
                checkTermSynchronized: this.state.sourceGraph ?
                    this.checkTermSynchronized.bind(this, this.state.sourceGraph, this.hierRelSource(), this.props.getNewVersionOfSynchronizedGraph.bind(this, this.state.sourceGraph.iri))
                    : undefined,
            });
    }

    private displayTargetAlignments() {//View  
        const targetMappings: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>> = this.state.alignment.getAlignedTargetTermsMap();
        return createElement(DisplayAlignedTermsComponent,
            {
                mappings: targetMappings,
                graph: this.state.targetGraph,
                selectedAlignment: this.state.selectedAlignmentTarget,
                iriprop: "targetIri",
                labelprop: "targetLabel",
                termStyle: this.getTermHiliteParentStyle,
                hilitedParents: this.state.hilitedParentsAtTarget,
                sortList: this.state.sortTargetList,
                onClickTerm: this.onClickAlignedTargetTerm,
                checkTermSynchronized: this.state.targetGraph ?
                    this.checkTermSynchronized.bind(this, this.state.targetGraph, this.hierRelTarget(), this.props.getNewVersionOfSynchronizedGraph.bind(this, this.state.targetGraph.iri))
                    : undefined,
            });
    }

    onClickAlignedSourceTerm = (clickedIri: Rdf.Iri, mappingList: List<AlignedTermsMapping>) => {

        //step 0: clear current focus when is already clicked
        if (this.state.viewSourceTerm && this.state.viewSourceTerm.find(x => x.value == clickedIri.value)) {
            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                viewSourceSelection: undefined,
                viewSourceTerm: undefined,
                viewTargetSelection: undefined,
                viewTargetTerm: undefined,
                selectedAlignmentSource: undefined,
                selectedAlignmentTarget: undefined,
            });
            return;
        }

        //else...
        //step 0: update UI - init new focus
        const viewSelected = this.setSelectedColor("source", clickedIri, mappingList);
        this.setStateFunc({
            alignment: this.state.alignment,
            selection: this.state.selection,
            selectedAlignmentSource: viewSelected.sourceSelected,
            selectedAlignmentTarget: viewSelected.targetSelected,
            viewSourceSelection: undefined,
            viewSourceTerm: undefined,
            viewTargetSelection: undefined,
            viewTargetTerm: undefined,
        });

        //step 1: pick the clicked source-term, to be shown at the source-tree
        let sourceIriList = List<Rdf.Iri>();
        sourceIriList = sourceIriList.push(clickedIri);

        //step 2: collect the parents of the clicked source-term from all the employed graphs, to be shown at the source-tree
        let sourceParentList = List<Rdf.Iri>();
        AlignmentRDF.getParents([this.sourceGraphIri()], sourceIriList.toArray(), this.hierRelSource()).onValue(res => {
            res.forEach(r => {
                sourceParentList = sourceParentList.push(r.parent);
            });

            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                viewSourceSelection: sourceParentList,
                viewSourceTerm: sourceIriList,
            });
        });

        //step 3: collect all of the related aligned target-terms from the given mapping-list, to be shown at the target-tree
        let targetIriList = List<Rdf.Iri>();
        mappingList.forEach(target => {
            targetIriList = targetIriList.push(target.targetIri);
        });

        //step 4: collect the parents of the given aligned target-terms from the employed target-graphs, to be shown at the target-tree
        let targetParentList = List<Rdf.Iri>();
        AlignmentRDF.getParents([this.targetGraphIri()], targetIriList.toArray(), this.hierRelTarget()).onValue(res => {
            res.forEach(r => {
                targetParentList = targetParentList.push(r.parent);
            });

            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                viewTargetSelection: targetParentList,
                viewTargetTerm: targetIriList.push(clickedIri),//NEW
            });
        })
    }//onClickAlignedSourceTerm


    onClickAlignedTargetTerm = (clickedIri: Rdf.Iri, mappingList: List<AlignedTermsMapping>) => {

        //step 0: clear current focus when is already clicked
        if (this.state.viewTargetTerm && this.state.viewTargetTerm.find(x => x.value == clickedIri.value)) {
            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                viewSourceSelection: undefined,
                viewSourceTerm: undefined,
                viewTargetSelection: undefined,
                viewTargetTerm: undefined,
                selectedAlignmentSource: undefined,
                selectedAlignmentTarget: undefined,
            });
            return;
        }

        //else...
        //step 0: update UI - init new focus
        const viewSelected = this.setSelectedColor("target", clickedIri, mappingList);
        this.setStateFunc({
            alignment: this.state.alignment,
            selection: this.state.selection,
            selectedAlignmentSource: viewSelected.sourceSelected,
            selectedAlignmentTarget: viewSelected.targetSelected,
            viewSourceSelection: undefined,
            viewSourceTerm: undefined,
            viewTargetSelection: undefined,
            viewTargetTerm: undefined,
        });

        //step 1: pick the clicked target-term ...
        let targetIriList = List<Rdf.Iri>();
        targetIriList = targetIriList.push(clickedIri);

        //step 1a: now collect all of the related aligned source-terms from the given mapping-list, to be shown at the target-tree
        mappingList.forEach(mapping => {
            targetIriList = targetIriList.push(mapping.sourceIri);
        });

        //step 2: collect the parents of the clicked target-term from all the target-graph, to be shown at the target-tree
        let targetParentList = List<Rdf.Iri>();
        AlignmentRDF.getParents([this.targetGraphIri(), this.props.loadAlignmentID], targetIriList.toArray(), `${this.hierRelTarget()} | ${this.hierRelAlignment()}`).onValue(res => {
            res.forEach(r => {
                targetParentList = targetParentList.push(r.parent);
            });

            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                viewTargetSelection: targetParentList,
                viewTargetTerm: targetIriList,
            });
        });

        //step 3: collect all of the related aligned source-terms from the given mapping-list, to be shown at the source-tree   
        let sourceIriList = List<Rdf.Iri>();
        mappingList.forEach(mapping => {
            sourceIriList = sourceIriList.push(mapping.sourceIri);
        });

        //step 4: collect the parents of the given aligned source-terms from the employed source-graph, to be shown at the source-tree
        let sourceParentList = List<Rdf.Iri>();
        AlignmentRDF.getParents([this.sourceGraphIri()], sourceIriList.toArray(), this.hierRelSource()).onValue(res => {
            res.forEach(r => {
                sourceParentList = sourceParentList.push(r.parent);
            });
            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                viewSourceSelection: sourceParentList,
                viewSourceTerm: sourceIriList,
            });
        })

    }//onClickAlignedTargetTerm


    //View
    private setSelectedColor(caseId: "source" | "target", iri: Rdf.Iri, map: List<AlignedTermsMapping>): { sourceSelected, targetSelected } {
        let sourceSelected = new Map<string, string>();
        let targetSelected = new Map<string, string>();

        if (caseId === "source") {
            sourceSelected.set(iri.value, "view-focus-terminal-term view-selected-alignment ");
            map.forEach(target => {
                target = <AlignedTermsMapping>target;
                targetSelected.set(target.targetIri.value, target.relation.value === this.props.exactMatchAlignmentRelation.iri.value ?
                    "view-focus-terminal-term view-selected-alignment-exact " : "view-focus-terminal-term view-selected-alignment-broader ");
            })
        } else {
            targetSelected.set(iri.value, " view-focus-terminal-term view-selected-alignment");
            map.forEach(mapping => {
                mapping = <AlignedTermsMapping>mapping;
                sourceSelected.set(mapping.sourceIri.value, " view-focus-terminal-term view-selected-alignment ");
            })
        }
        return { "sourceSelected": sourceSelected, "targetSelected": targetSelected }
    }

    //View. Function checks whether on view focus to return the view style or not.
    getTermFocusStyle = (term: Term, id: string): string => {
        let style = "";

        if (!this.state.viewSourceTerm || !this.state.viewTargetTerm) return style;

        if (id === "source") {
            this.state.viewSourceTerm.forEach(source => {

                if (term.iri.value === source.value) {
                    style = "view-focus-terminal-term";
                    return style;
                }
            })

            this.state.viewSourceSelection.forEach(parent => {
                if (parent && parent.value === term.iri.value) {
                    style = "view-focus-term";
                }
            })
        } else if (id === "target") {
            this.state.viewTargetTerm.forEach(target => {
                if (term.iri.value === target.value) {
                    style = "view-focus-terminal-term";
                    return style;
                }
            })

            this.state.viewTargetSelection.forEach(parent => {
                if (parent && parent.value === term.iri.value) {
                    style = "view-focus-term";
                }
            })
        } else if (id === "source@target") {
            this.state.viewTargetTerm.forEach(target => {
                if (term.iri.value === target.value) {
                    style = "view-focus-source-terminal-term";
                    return style;
                }
            })
        }
        return style;
    }

    updateSourceListSort = (order: 'asc' | 'desc') => {
        this.setStateFunc({
            alignment: this.state.alignment,
            selection: this.state.selection,
            sortSourceList: order,
        });
    };

    updateTargetListSort = (order: 'asc' | 'desc') =>
        this.setStateFunc({
            alignment: this.state.alignment,
            selection: this.state.selection,
            sortTargetList: order,
        });

    updateWaitForRefreshDB = (wait: boolean) =>
        this.setStateFunc({
            alignment: this.state.alignment,
            selection: this.state.selection,
            refreshingDBFlag: wait
        });
    setFocusTargetTerm = (term: Node) =>
        this.setStateFunc({
            alignment: this.state.alignment,
            //draggedTerm: this.state.draggedTerm, //undefined,//NEW?????
            selection: this.state.selection,
            focusTargetTerm: term,
        });
    resetFocusTargetTerm = () =>
        this.setStateFunc({
            alignment: this.state.alignment,
            //draggedTerm: undefined,
            selection: this.state.selection,
            focusTargetTerm: undefined,
            omitSourceTerm: undefined,
        });
    setDraggedTerm = (term: Term, htmlElement?: HTMLElement): void => {
        if (htmlElement) onFocusStartDragNodeFunc(htmlElement);
        this.setStateFunc({
            alignment: this.state.alignment,
            draggedTerm: term,
            selection: this.state.selection,
        });
    }
    getDraggedTerm = (): Term => { return this.state.draggedTerm; }
    expandNodeOnDrag = (term: Term): void => {
        _.assign(term, { "expanded": true });
        //To see the expansion the state has to be changed. So ...
        this.setStateFunc({
            alignment: this.state.alignment,
            draggedTerm: this.state.draggedTerm,
            expandNodeOnDrag: term,
            selection: this.state.selection
        });
    }

    isSelected = (term: Term): boolean => (this.state.selection && this.state.selection.getFirst(this.state.selectionMode.selectedRootKey)) ? this.state.selection.getFirst(this.state.selectionMode.selectedRootKey).iri.value === term.iri.value : false;
    getTermSearchStyle = (term: Term, searchSelection: TreeSelection<Node>): string => {

        if (!searchSelection) return "";
        let searchStyle: string = "";

        const nodesFound: Immutable.Set<SelectionNode<Node>> = TreeSelection.nodesFromKey(searchSelection, EmptyForest.keyOf(term));
        if (!nodesFound.isEmpty()) {
            searchStyle = "search-focus-term";
            if (TreeSelection.isTerminal(nodesFound.first())) {
                searchStyle = "search-focus-terminal-term";
            }
        }
        return searchStyle;
    }
    //Checks the "this.state.hilitedParents" to decide whether the current term is a hilited terminal or parent-term or neither
    getTermHiliteParentStyle = (term: Term, termStyle: string, parentStyle: string, hilitedParents: Map<Rdf.Iri, List<Rdf.Iri>>): string => {//| AlignedTermsMapping
        if (hilitedParents) {
            //_.assign(term, { "expanded": true });

            //A. Look into keys: if 'term' is found there, then it is a terminal term
            const keys = hilitedParents.keys();
            let k = keys.next();

            while (!k.done) {
                if (k.value.value == term.iri.value) return termStyle;
                k = keys.next();
            }

            //B. Look into values: if 'term' is found there, then it is a parent term
            const values = hilitedParents.values();
            let vList = values.next();//each value is a List<Rdf.Iri>
            while (!vList.done) {
                if (vList.value.find(x => {
                    return (x ? x.value == (<Term>term).iri.value : false);
                })) { return parentStyle; }
                vList = values.next();
            }
        }
        return "";
    }


    item2SourceNode = (item: Term | AlignedTermsMapping): Term => {
        if (item && item["iri"]) return <Term>item;
        if (item && item["sourceIri"]) return { iri: item["sourceIri"], label: item["sourceLabel"] };
        return <Term>item;
    }

    item2TargetNode = (item: Term | AlignedTermsMapping): Term => {
        if (item && item["iri"]) return <Term>item;
        if (item && item["targetIri"]) return { iri: item["targetIri"], label: item["targetLabel"] };
        return <Term>item;
    }

    /* 
    renderSourceTerm algorithm
     
    Displays the source-terms at source-tree.
    The source-terms are distinguished to aligned-source-terms and non-aligned-source-terms.
     
    Current term @source may be
        a. a aligned-source-term (check the 'alignedSourceTerms' collection)
        b. a non-aligned-target-term (check the 'alignedSourceTerms' collection)
     
    Steps:
     
    1. If (a aligned-source-term)? 
    --Yes:
    i. Highlight the term as aligned
     
    2. Highlight the term as "searched" (get the proper search-term-style), "hilited parent"
     
    3. Render the buttons/options next to the term
     
    4. Render draggable node, apply the proper style
    i. If (source-term is selected) => setDraggedTerm
     
    */

    renderSourceTerm = (node: Node): React.ReactElement<any> => {
        let term: Term = undefined;

        if (!term) term = node;

        let text = (term.label ? term.label.value : term.iri.value);
        text = (this.state.sourceGraph.prefix ? this.state.sourceGraph.prefix : "") + text;
        let nodeParts: ReactNode[] = [];//[text];
        let termStyle = undefined;

        /* Step 1 */
        if (this.state.alignment.isSourceTermAligned(term.iri)) {
            /* 1.i */
            termStyle = termStyle + " " + (this.state.alignment.isSourceTermExplicitlyAligned(term.iri) ? "aligned-term" : "aligned-term-implicitly");
        }

        /* Step 2 */
        termStyle = termStyle + " " + this.getTermSearchStyle(term, this.state.searchSourceSelection);
        termStyle = termStyle + " " + this.getTermHiliteParentStyle(term, "hilite-parent-terminal-term", "hilite-parent-term", this.state.hilitedParentsAtSource);
        termStyle = termStyle + " " + this.getTermHiliteParentStyle(term, "hilite-parent-terminal-term2", "hilite-parent-term2", this.state.hilitedNonAlignedAtSource);


        /* Step 3 */
        const viewStyle = this.getTermFocusStyle(term, "source");
        nodeParts.push(
            D.span({ className: viewStyle },
                text)
        );
        nodeParts.push(this.createSourceAlignmentFlag(term, this.sourceGraphIri(), this.targetGraphIri()));//checks for explicitly aligned children
        nodeParts.push(createInfoButton([this.sourceGraphIri()], term, this.refs.sourceTermInfo, this.hierRelSource(), [this.sourceGraphIri()], [this.sourceGraphIri()]));
        nodeParts.push(this.createParentsButton(term, true));
        // nodeParts.push(createSuperSourceAlignedTermsButton(this.props.loadAlignmentID, this.sourceGraphIri(), term, this.hierRelSource(), this.refs.displaySourceAlignment_ref, this.state.alignment.getAlignedSourceTermsMap(), this.addToSourceAlignedTermList.bind(this)));


        /* Step 4 */
        if (this.isSelected(term)) termStyle = termStyle + " " + "dragging-enter-term";
        return createElement(Draggable, { iri: term.iri.value },
            D.span({
                ref: () => node.iri.value,
                title: term.iri.value,
                className: term.error ? styles.error : termStyle,
                //onDragStart: () => { if (this.isSelected(term)) { this.setDraggedTerm(term) } } /* 4.i */
                onDragStart: (e) => {
                    //this.setDraggedTerm(term, this.isSelected(term) ? <HTMLSpanElement>e.target : undefined);
                    this.setDraggedTerm(term);
                }, /* 4.i */

            },
                nodeParts) as React.ReactElement<any>
        );

    }



    /* 
    renderTargetTerm algorithm
     
    Displays the target-terms and the aligned-source-terms at target-tree.
    The aligned-source-terms are distinguished to exact-match and broader-match terms.
     
    Current term @target may be
        a. an aligned-source-term (check the 'alignedSourceTerms' collection)
        b. an aligned-target-term (check the 'alignedTargetTermsMap' collection)
        c. an non-aligned-target-term (check the 'alignedTargetTermsMap' collection)
     
    Steps:
     
    1. If (a target-term)? 
    --Yes:
    i Render the buttons/options next to the term
    ii. Fetch all its alignments
    iii. Get its exact-match alignments
    iv. Put the target-term and all the inline-match (exact, close, related) source-terms (with a the appropriate buttons/options next to the terms) in the same tree-node
     
    --No:
    v. The current term is a non-exact-match aligned-source-term. (Currently treated as broader-match)
    vi. The current term is an explicit alignment (not an implicitly aligned child) so display the delete-button
    vii. Display the info-button at the current aligned-source-term
     
    2. Highlight the term as "searched": get the proper search-term-style
     
    3. Highlight the term as "child" of the pointed aligned-source-term
     
    4. Render
    i. If (target-term) => draggable and dropable node
    i. If (source-term) => draggable node
     
    */
    //ADD-RELATION

    renderTargetTerm = (node: Node): React.ReactElement<any> => {
        let term: Term = undefined;
        if (!term) term = node;

        if (!node.iri) return; //TODO bug: broader relation remove
        let text = (term.label ? term.label.value : term.iri.value);

        //let nodeParts: ReactNode[] = [text];
        let nodeParts: ReactNode[] = [];

        let termStyle = undefined;
        let isTargetTerm: boolean = false;


        /* Step 1 */
        if (!this.state.alignment.isSourceTermAligned(term.iri)) {//Distinguishing the source from the target terms: at target tree, all the source-terms are considered aligned (either implicitly or explicitly). So all the rest are target terms.
            isTargetTerm = true;
            text = (this.state.targetGraph.prefix ? this.state.targetGraph.prefix : "") + text;
            const viewStyle = this.getTermFocusStyle(term, "target");
            nodeParts.push(
                D.span(
                    { className: viewStyle },
                    text),
                (this.spinner_onDropAlignedTerm(node) ? D.span({ className: viewStyle }, Spinner({})) : "")
            );
            //nodeParts.push(text);

            /* i */
            nodeParts.push(this.createTargetAlignmentFlag(term, this.targetGraphIri()));
            nodeParts.push(createInfoButton([this.targetGraphIri()], term, this.refs.targetTermInfo, this.hierRelTarget(), [this.targetGraphIri()], [this.targetGraphIri()]));
            nodeParts.push(this.createParentsButton(term, true));


            /* ii */
            const alignedsourceTerms: List<AlignedTermsMapping> = this.state.alignment.getTargetTermRelation(node.iri);//checks whether the target term is aligned

            if (alignedsourceTerms) {
                termStyle = "aligned-term";
                const alignedsourceTerms: List<AlignedTermsMapping> = this.state.alignment.getTargetTermRelation(node.iri);

                const nodePartsDisplayInlineMatch = (item: AlignedTermsMapping): { iri: Rdf.Iri; symbol: String; inversedRelation: boolean; hierRelAlignment: () => string; style: string } => {
                    let displayMatchRelation: { iri: Rdf.Iri; symbol: string; inversedRelation: boolean; hierRelAlignment: () => string, style: string };
                    if (item["relation"].value == this.props.exactMatchAlignmentRelation.iri.value) {
                        displayMatchRelation = _.assign({}, { iri: this.props.exactMatchAlignmentRelation.iri, symbol: "   =   ", inversedRelation: false, hierRelAlignment: this.hierRelAlignment, style: "aligned-term-exact" });
                    } if (item["relation"].value == this.props.closeMatchAlignmentRelation.iri.value) {
                        displayMatchRelation = _.assign({}, { iri: this.props.closeMatchAlignmentRelation.iri, symbol: "   ≈   ", inversedRelation: false, hierRelAlignment: undefined, style: "aligned-term-close" });
                    } if (item["relation"].value == this.props.relatedMatchAlignmentRelation.iri.value) {
                        displayMatchRelation = _.assign({}, { iri: this.props.relatedMatchAlignmentRelation.iri, symbol: "   ~   ", inversedRelation: false, hierRelAlignment: undefined, style: "aligned-term-related" });
                    }
                    return displayMatchRelation;
                }

                /* iii */
                alignedsourceTerms.forEach(item => {
                    const inlineMatchRelation = nodePartsDisplayInlineMatch(item);
                    if (inlineMatchRelation) {

                        const itemLabel = (this.state.sourceGraph.prefix ? this.state.sourceGraph.prefix : "") + item.sourceLabel.value;
                        termStyle = termStyle + " " + this.getTermHiliteParentStyle(<Term>this.item2SourceNode(item), "hilite-parent-terminal-term", "hilite-parent-term", this.state.hilitedParentsAtTarget);


                        /* iv */
                        nodeParts.push(D.span({ className: "relation-inline-symbol" }, inlineMatchRelation.symbol)),
                            nodeParts.push(
                                createElement(AlignedElement, { //EXACT, CLOSE, RELATED MATCH ELEMENT
                                    inlineTerm: true,
                                    sourceNG: this.sourceGraphIri(),
                                    AlignmentNG: this.alignmentNG,
                                    sourceTerm: item.sourceIri,
                                    sourceLabel: itemLabel,
                                    targetTerm: node,
                                    relation: inlineMatchRelation.iri,
                                    inversedRelation: inlineMatchRelation.inversedRelation,
                                    nodeExpanded: term.expanded,
                                    removeTerm: this.removeTerm,
                                    hiliteSourceTermChildren: this.hiliteSourceTermChildren,
                                    parentsButton: this.createParentsButton(<Term>this.item2SourceNode(item), true),
                                    infoButton: createInfoButton([this.targetGraphIri(), this.props.loadAlignmentID], <Term>this.item2SourceNode(item), this.refs.targetTermInfo, this.hierRelSource() + "|" + this.hierRelAlignment() + "|" + this.props.broadMatchAlignmentRelation.iri, [this.sourceGraphIri(), this.targetGraphIri()], [this.sourceGraphIri()]),
                                    hierarchyRelation: inlineMatchRelation.hierRelAlignment,
                                    termStyle: inlineMatchRelation.style + " " + this.getTermFocusStyle({ iri: item.sourceIri }, "source@target"),
                                })
                            );
                    }
                });
            }

            if (this.state.focusTargetTerm && this.state.focusTargetTerm === term) {
                termStyle = "dragging-enter-term";
            }
        }
        /* v */
        else {//This case includes all the source terms aligned at target with not inline relations
            //Aligned-source-terms @Target: aligned explicitly or implicitly (by context) or both
            //if isSourceTermExplicitlyAlignedInContext is true this term is a source-term explicitly aligned (not a child)
            text = (this.state.sourceGraph.prefix ? this.state.sourceGraph.prefix : "") + text;

            const isExplicitlyAlignedTerm: boolean = this.state.alignment.isSourceTermExplicitlyAlignedInContext(term.iri, this.targetForest.getParent(term).iri, this.props.broadMatchAlignmentRelation.iri);//ADD-RELATION
            termStyle = (isExplicitlyAlignedTerm ? "aligned-term-broader" : "aligned-term-broader-implicitly");
            termStyle = termStyle + " " + this.getTermFocusStyle(term, "source@target");

            nodeParts.push(
                createElement(AlignedElement, { //BROADER MATCH ELEMENT
                    sourceNG: this.sourceGraphIri(),
                    AlignmentNG: this.alignmentNG,
                    sourceTerm: node.iri,
                    sourceLabel: text,
                    targetTerm: this.targetForest.getParent(term),
                    relation: isExplicitlyAlignedTerm ? this.props.broadMatchAlignmentRelation.iri : this.props.broaderAlignmentRelation.iri,
                    inversedRelation: false,
                    removeTerm: this.removeTerm,//(isExplicitlyAlignedTerm) ? this.removeTerm : undefined, /* vi */
                    hiliteSourceTermChildren: undefined,
                    parentsButton: this.createParentsButton(term, true),
                    nodeExpanded: term.expanded,
                    infoButton: createInfoButton([this.targetGraphIri(), this.props.loadAlignmentID], term, this.refs.targetTermInfo, this.hierRelSource() + "|" + this.hierRelAlignment() + "|" + this.props.broadMatchAlignmentRelation.iri, [this.sourceGraphIri(), this.targetGraphIri()], [this.sourceGraphIri()]), /* vii */
                })
            );

        } //else

        /* Step 2 */
        termStyle = termStyle + " " + this.getTermSearchStyle(term, this.state.searchTargetSelection);
        termStyle = termStyle + " " + this.getTermHiliteParentStyle(term, "hilite-parent-terminal-term", "hilite-parent-term", this.state.hilitedParentsAtTarget);


        /* Step 3 */
        if (node["hilite-aligned-child-prop"]) {
            termStyle = termStyle + " " + "hilite-aligned-child";
        }

        /* Step 4 */
        /* i */
        if (isTargetTerm) { //Droppable && Draggable

            return createElement(Draggable, { iri: term.iri.value },

                createElement(Droppable, { //Display a default target term
                    query: `ASK { ?value ?y ?z }`,
                    onDrop: (draggedTerm: Rdf.Iri) => {
                        //console.log("onDrop at Droppable" + text);
                        //clearTimeout(this.waitToExpand);
                        if (!this.state.selection) return;

                        const sourceTerm: Term = this.getDraggedTerm();
                        if (!this.isSelected(sourceTerm)) return;
                        this.setFocusTargetTerm(term);
                    },//onDrop
                },

                    D.span({
                        title: term.iri.value,
                        className: term.error ? styles.error : termStyle,
                        onDragEnter: (e) => {
                            const draggedTerm = this.getDraggedTerm();
                            if (draggedTerm && this.isSelected(draggedTerm)) { e.currentTarget.setAttribute("class", "dragging-enter-term") }
                        },
                        onDragLeave: function (e) { e.currentTarget.setAttribute("class", termStyle) }

                        //TODO
                        // onDragEnter: (e) => {
                        //     //clearTimeout(this.waitToExpand);
                        //     //console.log("onDragEnter " + text);
                        //     if (term.hasMoreItems && !term.expanded)
                        //         this.waitToExpand = setTimeout(this.expandNodeOnDrag, 2500, term);

                        // },
                        // onDragLeave: (e) => {
                        //     clearTimeout(this.waitToExpand);
                        //     //console.log("onDragLeave " + text);
                        // },

                    },
                        ...nodeParts) as React.ReactElement<any>,

                ),
            );
        }
        /* ii */
        else { //Only Draggable
            return createElement(Draggable, { iri: term.iri.value },
                D.span({
                    title: term.iri.value,
                    className: term.error ? styles.error : termStyle,
                    //onDragStart: () => {if (this.isSelected(term)) {this.setDraggedTerm(term)}}
                    onDragStart: () => { this.setDraggedTerm(term) }
                },
                    ...nodeParts) as React.ReactElement<any>
            );
        }
    }


    /* 
    ---How the target-tree is rendered---

    The given children-query runs ONLY when a node at the target-tree is expanded for the very first time
    and refers to both the target and the alignment graph and thus the hierarchy of the aligned source terms is also considered.
    When a new alignment or an already aligned source-term is modified, this has to be presented at the target-tree.
    This works for the collapsed target nodes and not for the already expanded nodes that are not updated any more by the children query. 
    For this reason there is the need for manually updating the already expanded tree nodes and this is achieved via the update of the targetforest.
    That is applied in both cases: creating a new or removing an existing alignment.

    */

    /*
    removeTerm algorithm
    
    Removes a specific alignment: (removable-source-term, target-term, relation)
    
    Steps:
    
        1. Get the alignment multiplicity for all the children of the removed source term in order to update the alignment-tracker (about hilighting) to 'false'
        
        2. Update the target tree (not in DB but on UI): remove the removableTerm from all the tree-nodes where the pattern  removableTerm-relation-targetTerm is found
        
        Update the target tree (not in DB but on UI): get the direct children of/and the removed source term, that their nodes can be removed from the target tree
            Note1: when a term is removed not all its direct children can be removed too, due to possible other alignment relations.(db has to be qyeried)
            Note2: all the instances of a narrow term, throughout the tree, have to be removed unless they are explicitly aligned to the target term.(db has to be qyeried)

        3. Update db: delete all the exclusive triples of the current source term that are not involved in other alignments (ONLY THE DIRECT CHILDREN, DUE TO PERFORMANCE)

        4. Update db: delete the current source-term-alignment
    
        5. Remove the source-term-alignment from alignedTargetTermsMap

            5a. Check whether there are more alignments for the source and the target term, to update the flag caching. This must be executed after
                the removal business logic has been completed in order to decide whether cashing has to be cleared

        6. Update State
    
    */

    private removeTerm = (removableTerm: Rdf.Iri, targetTerm: Node, relation: Rdf.Iri, inversed: boolean, updateFunc?: () => void): void => {
        /*
            DB, contains the hierarchy as triples.
            Forest entity holds the information about how to build the tree, the node entities and whether they have children.
            (Semantic) Tree, represents the Forest. Clicking on nodes the Forest mey get updated if new children have to be shown.
        */

        // console.log("removableTerm is", removableTerm.value);
        // console.log("targetTerm is", targetTerm.label);
        // console.log("relation is", relation.value);

        //this.targetTree is what is rendered while this.targetForest is the structure that is created by the target query dynamiacally. 


        this.alignmentNG.onValue(NGIri => {
            const currAlignment = this.state.alignment;
            const forest = this.targetTree.state.forest; // this.targetForest
            const path = forest.getOffsetPath(targetTerm);

            /*When the source term is aligned more than once the children should stay implicitly aligned (color is not changed)
            and should not be removed from the rdf graph*/

            /* Step 1 */                                                                    ////Before any deleting in the DB
            AlignmentRDF.getAlignmentMultiplicityOfSourceTerm(removableTerm, NGIri, this.sourceGraphIri(), this.targetGraphIri()).onValue(res => {//#1
                //console.log("getAlignmentMultiplicityOfSourceTerms", removableTerm.value, res);
                res.forEach(item => {
                    //console.log((item.alignmentMultiplicity).toJSON().value);
                    if (new Number((item.alignmentMultiplicity).toJSON().value) <= 1) {     ////The case which the "item" is involved ONLY ONCE in the alignment result
                        //.trackSourceTermAlignment(item.child, false);
                        currAlignment.trackSourceTermAlignment(removableTerm, false);
                        // recursively check multiplicity of children Checkhow all the children get implicitly aligned and use the same idea
                        this.recursivelyUnhiliteChildren(NGIri, removableTerm, currAlignment);
                    }
                    else if (this.targetForest.fromOffsetPath(path).children) {           ////The case which the "item" is involved MORE THAN ONCE in the alignment result
                        this.targetForest.fromOffsetPath(path).children.forEach(child => _.assign(child, { "hilite-aligned-child-prop": false }));//clear highlighting
                    }
                });


                const forestnodes: Immutable.Map<string, Immutable.Set<Node>> = forest.nodes;
                const key: string = targetTerm.iri.value;
                const targetTermNodeSet = forestnodes.get(key).asImmutable(); //set of nodes that the target term exist


                /*method A*//* Updates the tree based on updateChildrenFunc() where children are taken from targetForest */
                const updateChildrenFunc__byRemovingOne = (children: List<Node>) => {
                    let newChildren: List<Node> = children.asMutable();
                    let x: number = 0;
                    newChildren.forEach(child => {
                        // if (child.iri.value != removableTerm.value) { newChildren.push(child) }
                        if (child.iri.value == removableTerm.value) {
                            console.log("child found and set to null", child.iri.value);
                            child = null;
                            console.log("child found and REMOVED from position ", x);
                            newChildren.remove(x);
                        } else { x = x + 1; }

                    });
                    //children = _.assign({}, newChildren);
                    console.log("children=", newChildren);
                    return newChildren.asImmutable();
                }

                //The forest needs an updateChildren function to update the children of a node
                const updateNodeChildren = (targetTermNode) => {
                    const targetNodePath = forest.getOffsetPath(targetTermNode);
                    if (forest.fromOffsetPath(targetNodePath).children)
                        forest.fromOffsetPath(targetNodePath).children.forEach(child => {
                            if (child.iri.value == removableTerm.value) {
                                this.targetTree.removeChildren(child, targetNodePath);
                            }
                        })
                    forest.updateChildren(targetNodePath, updateChildrenFunc__byRemovingOne);
                }


                /*method A*//* Removes from the tree but not safe to remove a child without further check if this is valid CANNOT WORK IF RELATION IS ALREADY DELETED IN DB *//* WORKS BADLY! */
                const updateTreeMethodA = () => {
                    targetTermNodeSet.forEach(targetTermNode => {//iterate all the node-instances of the targetTerm in the targetForest
                        updateNodeChildren(targetTermNode);
                    });
                    this.targetTree.forceUpdate();

                }//method A 
                //updateTreeMethodA();
                //if (true) return;

                /*method B*//* Removes from the tree only the allowed nodes CANNOT WORK IF RELATION IS ALREADY DELETED IN DB *//* WORKS BADLY CAUSE IT CLOSES THE AFFECTED NODE! */
                const updateTreeMethodB = () => {
                    targetTermNodeSet.forEach(targetTermNode => {//iterate all the node-instances of the targetTerm in the targetForest
                        const targetNodePath = forest.getOffsetPath(targetTermNode);
                        AlignmentRDF.isRemovableNode(NGIri, removableTerm, relation, targetTermNode.iri)
                            .onValue(isAllowed => {
                                console.log('isAllowed', isAllowed);
                                if (isAllowed || true) {
                                    updateNodeChildren(targetTermNode);
                                }

                            })
                    })
                }//method B
                //updateTreeMethodB();

                /*method C*//* Updates the tree. Method based on removing all children and reload from DB *//* WORKS! */
                const updateTreeMethodC = () => {
                    targetTermNodeSet.forEach(targetTermNode => {//iterate all the node-instances of the targetTerm in the targetForest
                        const targetNodePath = forest.getOffsetPath(targetTermNode);
                        if (targetTermNode.children) {
                            targetTermNode.children.forEach(child => {
                                this.targetTree.removeChildren(child, targetNodePath);
                            })
                            const childrenQ: string = this.state.targetQueries.childrenQuery;
                            const childrenQ1 = childrenQ.replace(/\?parent/g, "" + targetTerm.iri);
                            const children = AlignmentRDF.selectQuery(childrenQ1);
                            this.targetTree.appendChildren2(targetTerm, targetNodePath, children);
                        }
                    });
                }//method C


                const removeAtDB = () => AlignmentRDF.removeAlignedSourceTermFromAlignmentGraph(NGIri, removableTerm, relation, targetTerm.iri)
                    .onValue(done => {
                        console.log("Triple deleted -1-");
                        //      }).onError(e => console.log("Error @removeAlignedSourceTermFromAlignmentGraph" + e))

                        updateTreeMethodC();

                        /* Step 5 */
                        currAlignment.releaseAlignment(removableTerm, relation, targetTerm.iri, inversed);

                        /* 5a */ //update caching
                        if (!currAlignment.isSourceTermExplicitlyAligned(removableTerm)) {
                            const keys = this.cachedSourceTermsFlagged.keys();
                            let next = keys.next();
                            while (next && !next.done) {
                                if (next.value.value == removableTerm.value) {
                                    this.cachedSourceTermsFlagged.delete(next.value);
                                    next = undefined;
                                }
                                next = keys.next();
                            }
                        }

                        if (!currAlignment.getAlignedTargetTermsMap().has(targetTerm.iri)) {
                            const keys = this.cachedTargetTermsFlagged.keys();
                            let next = keys.next();
                            while (next && !next.done) {
                                if (next.value.value == targetTerm.iri.value) {
                                    this.cachedTargetTermsFlagged.delete(next.value);
                                    next = undefined;
                                }
                                next = keys.next();
                            }
                        }


                        /* Step 6 */
                        //clear the View-highlighting of the removed alignment
                        if (this.state.viewSourceTerm && this.state.viewSourceTerm.find(x => x.value == removableTerm.value) &&
                            this.state.viewTargetTerm && this.state.viewTargetTerm.find(x => x.value == targetTerm.iri.value)) {
                            this.updateAlignmentState(currAlignment, true); //console.log('updateAlignmentState 1');
                        } else {
                            this.updateAlignmentState(currAlignment, false); //console.log('updateAlignmentState 2');
                        }
                        if (updateFunc) updateFunc(); //console.log(updateFunc);
                        console.log('removeTerm completed!');

                        //this.refreshDB(currAlignment);

                    }).onError(e => console.log("Error @removeAlignedSourceTermFromAlignmentGraph" + e))//new

                removeAtDB();

                // });//#2
            });//#1
        }).onError((e: Error) => {
            console.log("Error");
            console.log(e.message);
        });

    }

    private recursivelyUnhiliteChildren(alignmentNG: Rdf.Iri, term, currAlignment) {
        AlignmentRDF.getTermDirectNonAlignedChildren(alignmentNG, term, this.targetGraphIri()).onValue(res => {
            res.forEach(r => {
                if (r.child) {
                    const childToCheck = r.child;
                    AlignmentRDF.getAlignmentMultiplicityOfSourceTerm(childToCheck, alignmentNG, this.sourceGraphIri(), this.targetGraphIri()).onValue(res => {//#1
                        console.log("getAlignmentMultiplicityOfSourceTerms", childToCheck.value, res);
                        res.forEach(item => {
                            console.log((item.alignmentMultiplicity).toJSON().value);
                            if (new Number((item.alignmentMultiplicity).toJSON().value) <= 1) {     ////The case which the "item" is involved ONLY ONCE in the alignment result
                                //.trackSourceTermAlignment(item.child, false);
                                currAlignment.trackSourceTermAlignment(childToCheck, false);
                                console.log("item.child false", item.child);
                            }
                        });
                        this.recursivelyUnhiliteChildren(alignmentNG, childToCheck, currAlignment);
                    })
                }
            })
        })
    }


    recursivelyRemoveOrphans = (alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, targetNG: Rdf.Iri, currAlignment?) => {
        if (!currAlignment) currAlignment = this.state.alignment;
        AlignmentRDF.getOrphanAlignedTerms(alignmentNG, sourceNG, targetNG, "" + this.props.broaderAlignmentRelation.iri).onValue(res => {
            let ntriples: string = "";
            res.forEach(item => {
                const orphanTerm: string = "" + item.orphanTerm;
                const child: string = "" + item.child;
                const deleteChild: boolean = Boolean("" + item.deleteChild);
                ntriples += `${child} ${"" + this.props.broaderAlignmentRelation.iri} ${orphanTerm} .`;
                currAlignment.trackSourceTermAlignment(item.orphanTerm, false);             //-----------Correct!
                if (deleteChild) currAlignment.trackSourceTermAlignment(item.child, false); //-----------Correct!
            });
            if (ntriples.length > 0) {
                AlignmentRDF.removeSourceChildTermFromAlignmentGraph(alignmentNG, ntriples).onValue(v => {
                    this.recursivelyRemoveOrphans(alignmentNG, sourceNG, targetNG, currAlignment);
                });
            } else {
                this.updateWaitForRefreshDB(false);
                this.updateAlignmentState(currAlignment, true);
            }
        })
    }

    //Called onMouseEnter/Leave on an exact-match term @target tree
    private hiliteSourceTermChildren = (sourceTerm: Rdf.Iri, targetTerm: Node, relation: Rdf.Iri, hilite: boolean) => {
        this.alignmentNG.onValue(NGIri => {
            const currAlignment = this.state.alignment;

            AlignmentRDF.getSourceTermDirectChildrenAtGraph(sourceTerm, NGIri, this.sourceGraphIri(), this.hierRelAlignment)
                .onValue(res => {
                    res.forEach(item => {//["child","label"]

                        if (this.targetForest.nodes.get(item["child"].value)) {
                            this.targetForest.nodes.get(item["child"].value).forEach(child => {
                                if (this.targetForest.getNodePath(child).find(n => n === targetTerm)) {
                                    _.assign(child, { "hilite-aligned-child-prop": hilite });
                                    //console.log("hilite child " + child);
                                }
                            });
                        }
                    });

                    //setState to force render...
                    this.setStateFunc({
                        alignment: this.state.alignment,
                        selection: this.state.selection,
                        searchSourceSelection: this.state.searchSourceSelection,
                        searchTargetSelection: this.state.searchTargetSelection,
                    });
                });

        }).onError((e: Error) => {
            console.log("Error");
            console.log(e.message);
        });
    }

    //Called when the '@' button is clicked
    private hiliteParentsOfTerms = (terms: Rdf.Iri[], hilite: boolean) => {
        //console.log("hiliteParentsOfTerms uses hierarchyRelation: " + hierarchyRelation);

        if (!hilite) {//Clear hilighting and return
            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                hilitedParentsAtSource: undefined,
                hilitedParentsAtTarget: undefined,
            });
            return;
        }

        //...else retrieve the items to be hilited
        let hilitedParentsAtSource = new Map<Rdf.Iri, List<Rdf.Iri>>();
        terms.forEach(t => hilitedParentsAtSource.set(t, List<Rdf.Iri>()));//NEW, to include the current term even it has no parents
        let hilitedParentsAtTarget = new Map<Rdf.Iri, List<Rdf.Iri>>();
        terms.forEach(t => hilitedParentsAtTarget.set(t, List<Rdf.Iri>()));//NEW, to include the current term even it has no parents

        // `${this.hierRelSource()} | ${this.hierRelTarget()} | ${this.props.broaderAlignmentRelation.iri} | ${this.props.broadMatchAlignmentRelation.iri}  `



        AlignmentRDF.getParents([this.sourceGraphIri()], terms, this.hierRelSource())
            .onValue(res => {
                //@SOURCE NG

                res.forEach(tuple => {
                    const term = terms.find(t => t.value == tuple["child"].value);
                    if (term) {
                        let parentList: List<Rdf.Iri> = hilitedParentsAtSource.get(term) ? hilitedParentsAtSource.get(term) : List<Rdf.Iri>();
                        parentList = parentList.push(<Rdf.Iri>tuple["parent"]);
                        hilitedParentsAtSource.set(term, parentList);
                    }
                });

                AlignmentRDF.getParents([this.targetGraphIri(), this.props.loadAlignmentID], terms, `${this.hierRelTarget()} | ${this.props.broaderAlignmentRelation.iri} | ${this.props.broadMatchAlignmentRelation.iri}`)
                    .onValue(res2 => {
                        //TARGET + ALIGNMENT NG
                        res2.forEach(tuple => {
                            const term = terms.find(t => t.value == tuple["child"].value);
                            if (term) {
                                let parentList: List<Rdf.Iri> = hilitedParentsAtTarget.get(term) ? hilitedParentsAtTarget.get(term) : List<Rdf.Iri>();
                                parentList = parentList.push(<Rdf.Iri>tuple["parent"]);
                                hilitedParentsAtTarget.set(term, parentList);
                            }
                        });

                        //setState to force render...
                        this.setStateFunc({
                            alignment: this.state.alignment,
                            selection: this.state.selection,
                            hilitedParentsAtSource: hilitedParentsAtSource,
                            hilitedParentsAtTarget: hilitedParentsAtTarget,
                            searchingForNonAlignedFlag: false,
                        });
                    }).onError((e: Error) => {
                        console.log("Error");
                        console.log(e.message);
                    });

            }).onError((e: Error) => {
                console.log("Error");
                console.log(e.message);
            });
    }

    //Create parents-button as React-bootstrap button
    private createParentsButton = (term: Node, hilite: boolean) => createFactory(Button)({
        title: "Locate term in hierarchy",
        //bsSize: "small",
        bsStyle: 'link',
        className: "aligned-children_btn symbol",
        onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();

            //Clicking the same term toggles (clears) the highlighting
            if (this.state.hilitedParentsAtSource) {
                const parentKeys = this.state.hilitedParentsAtSource.keys();
                let tmp = parentKeys.next();
                while (!tmp.done) {
                    if (tmp.value.value == term.iri.value) {//term is found
                        this.setStateFunc({
                            alignment: this.state.alignment,
                            selection: this.state.selection,
                            hilitedParentsAtSource: undefined,
                            hilitedParentsAtTarget: undefined,
                        });
                        return;
                    }
                    tmp = parentKeys.next();
                }
            }
            this.hiliteParentsOfTerms([term.iri], hilite);
        },
    });

    private createSourceAlignmentFlag = (term: Node, sourceNG: Rdf.Iri, targetNG: Rdf.Iri) => {
        //console.log("*** createSourceAlignmentFlag for term ***" + term.iri);

        let iterSet: Iterator<Set<Rdf.Iri>> = this.cachedSourceTermsFlagged.values(); //each value is a Set<Rdf.Iri>
        let nextSet = iterSet.next();

        while (!nextSet.done) {
            const setValues = nextSet.value.values();
            let nextItem = setValues.next();
            while (!nextItem.done) {
                if (nextItem.value.value == term.iri.value) {
                    //console.log("create flag for term " + term.iri.value);
                    //create the flag here
                    const flag = D.span({ title: "Contains aligned terms", className: "aligned-term" }, "*");
                    _.assign(term, { alreadyAlignedChildren: true });
                    return flag;
                }
                nextItem = setValues.next();
            }
            nextSet = iterSet.next();
        }
        _.assign(term, { alreadyAlignedChildren: false });
        //console.log("*** NO FLAG WAS CREATED ***");
        return undefined;
    }

    private createTargetAlignmentFlag = (term: Node, targetNG: Rdf.Iri) => {

        let iterSet: Iterator<Set<Rdf.Iri>> = this.cachedTargetTermsFlagged.values(); //each value is a Set<Rdf.Iri>
        let nextSet = iterSet.next();

        while (!nextSet.done) {
            const setValues = nextSet.value.values();
            let nextItem = setValues.next();
            while (!nextItem.done) {
                if (nextItem.value.value == term.iri.value) {
                    //console.log("create flag for term " + term.iri.value);
                    //create the flag here
                    const flag = D.span({ title: "Contains aligned terms", className: "aligned-term" }, "*");
                    _.assign(term, { alreadyAlignedChildren: true });
                    return flag;
                }
                nextItem = setValues.next();
            }
            nextSet = iterSet.next();
        }
        _.assign(term, { alreadyAlignedChildren: false });
        return undefined;
    }

    //Recursively perform the alignment rule-check
    private createRelationSelectionElement = (sourceTerm: Node, targetTerm: Node): ReactElement<any> => {
        // TODO
        //NEW
        const RulesComponentElement = createElement(RulesComponent, {
            rules: this.props.alignmentRules,
            sourceTerm: sourceTerm,
            targetTerm: targetTerm,
            alignmentNG: this.alignmentNG,
            sourceNG: this.sourceGraphIri(),
            targetNG: this.targetGraphIri(),

            prefices: this.props.prefices,
            labelRelation: this.props.labelRelation,
            hierRelSource: this.hierRelSource(),
            hierRelTarget: this.hierRelTarget(),
            hierRelAlignment: this.hierRelAlignment(),
            exactMatchAlignmentRelation: this.props.exactMatchAlignmentRelation,
            closeMatchAlignmentRelation: this.props.closeMatchAlignmentRelation,
            relatedMatchAlignmentRelation: this.props.relatedMatchAlignmentRelation,
            broadMatchAlignmentRelation: this.props.broadMatchAlignmentRelation,

            onSelectRelationFunc: (selectedKey) => { //selectedKey: { relation: Relation, inversed: boolean }
                this.dropNewAlignedTerm(sourceTerm, targetTerm, selectedKey["relation"], selectedKey["inversed"], (this.state.omitSourceTerm === sourceTerm));
                this.resetFocusTargetTerm();
            },
            onSelectOption_onlySubTerms_Func: () => this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                omitSourceTerm: sourceTerm,
            }),
            onAlertExceptionFunc: this.resetFocusTargetTerm,
            onCloseDialogFunc: this.resetFocusTargetTerm,

            askQueryFunc: AlignmentRDF.askQuery,//(query: string) => Kefir.Property<any>;
            selectQueryFunc: AlignmentRDF.selectQuery,//(query: string) => Kefir.Property<any>;
            selectQueryResult: AlignmentRDF.selectQueryResult,//(queryResult: Kefir.Property<any>) => Kefir.Property<{ [key: string]: Rdf.Node }>;
        });
        return RulesComponentElement;
    }


    //CREATES NEW ALIGNMENT AFTER DROP (See note ---How the target-tree is rendered---)

    //it allows orphan non-aligned source-terms in the alignment graph, to be removed at a post phase
    /*
    NOTE: this.targetForest vs this.targetTree.state.forest
    When need to update tree children, use this.targetTree, that causes the state update of the tree.
    But, when need to "read" the forest structure, use this.targetForest, which is the most-updated reference to the tree-structure
    */
    private dropNewAlignedTerm(sourceTermOrigin: Node, targetTerm: Node, relation, inversed: boolean, onlySourceTermChildren: boolean): void {

        const leaves: List<any> = TreeSelection.leafs(this.state.selection);

        //console.log(sourceTermOrigin);
        let sourceTerm = _.cloneDeep<Node>(sourceTermOrigin);
        // console.log(sourceTermOrigin.iri);
        // console.log(sourceTermOrigin.label);
        //The next _.assign is a workaround for the unreliable result of _.cloneDeep 
        const sourceLabel = sourceTermOrigin.label ? sourceTermOrigin.label : sourceTermOrigin.iri;
        const sourceDatatype = sourceTermOrigin.label ? sourceTermOrigin.label.dataType : undefined;
        _.assign(sourceTerm, { iri: new Rdf.Iri(sourceTermOrigin.iri.value), label: new Rdf.Literal(sourceLabel.value, sourceDatatype) });
        //console.log(sourceTerm);

        //Constrain param 'onlySourceTermChildren' to be used only with broader-match relation
        if (onlySourceTermChildren && relation.iri.value != this.props.broadMatchAlignmentRelation.iri.value) onlySourceTermChildren = false;

        let currAlignment = this.state.alignment;

        if (relation.iri.value == this.props.closeMatchAlignmentRelation.iri.value || relation.iri.value == this.props.relatedMatchAlignmentRelation.iri.value) {//for close- and related- match ignore term hierarcy
            this.alignmentNG.onValue(NGIri => {

                currAlignment.addAlignment(sourceTerm.iri, sourceTerm.label, relation.iri, targetTerm.iri, targetTerm.label, inversed);
                currAlignment.trackSourceTermAlignment(sourceTerm.iri, true);//----------Correct!

                const hierRelTarget = this.hierRelTarget();
                const hierRelSource = this.hierRelSource();

                //Caching target flags
                if (!this.cachedTargetTermsFlagged.has(targetTerm.iri)) {
                    this.cachedTargetTermsFlagged.set(targetTerm.iri, new Set());//init
                }
                if (this.state.targetGraph && this.state.hierarchyRelations) this.recursivelyGetParents([this.targetGraphIri()], targetTerm.iri, targetTerm.iri, hierRelTarget, this.cachedTargetTermsFlagged);

                //Caching source flags
                if (!this.cachedSourceTermsFlagged.has(sourceTermOrigin.iri)) {
                    this.cachedSourceTermsFlagged.set(sourceTermOrigin.iri, new Set());//init
                }
                if (this.state.sourceGraph && this.state.hierarchyRelations) this.recursivelyGetParents([this.sourceGraphIri()], sourceTermOrigin.iri, sourceTermOrigin.iri, hierRelSource, this.cachedSourceTermsFlagged);

                this.updateAlignmentState(currAlignment);

                //Update the graph store
                //let newGraph: Kefir.Property<Rdf.Graph> = AlignmentRDF.createAlignmentGraphTriple(sourceTerm.iri, targetTerm.iri, relation);
                let triple = Rdf.triple(sourceTerm.iri, relation.iri, targetTerm.iri);
                //let newGraph: Rdf.Graph = Rdf.graph([triple]);
                AlignmentRDF.uploadTriple(NGIri, `${sourceTerm.iri} ${relation.iri} ${targetTerm.iri}`);
            });
            return;
        }


        //Preparation: distinguish leafs from branches
        let terminalNodes: Array<ReadonlyArray<SelectionNode<Node>>> = [];                  //Terminal nodes are considered as FULLY SELECTED IN ALL THEIR DEPTH
        let partiallySelectedParentNodes: Array<ReadonlyArray<SelectionNode<Node>>> = [];   //Partially-selected nodes are considered as leafs (nodes WITH NO DEPTH)

        TreeSelection.leafs(this.state.selection).forEach(leaf => {
            if (TreeSelection.isTerminal(leaf)) {
                let nodeParentPath: ReadonlyArray<SelectionNode<Node>> = this.state.selection.getNodePath(leaf);
                nodeParentPath = nodeParentPath.slice(nodeParentPath.indexOf(this.state.selection.getFirst(this.state.selectionMode.selectedRootKey)));
                terminalNodes.push(nodeParentPath);
            } else {
                let leafnodeParentPath: ReadonlyArray<SelectionNode<Node>> = this.state.selection.getNodePath(leaf);
                leafnodeParentPath = leafnodeParentPath.slice(leafnodeParentPath.indexOf(this.state.selection.getFirst(this.state.selectionMode.selectedRootKey)));
                partiallySelectedParentNodes.push(leafnodeParentPath);
            }
        })


        /*1. Target tree update should be applied in all instances of the sourceTerm-nodes and not only to the currently aligned (because the sourceTerm hierarchy may have been changed)
            First, remove the sourceTerm hierarchy from the alignment graph except for the contained already explicitly aligned children.
            This has two phases:
                a. remove from graph store
                b. remove from target-tree
        */
        this.alignmentNG.onValue(NGIri => {

            //Update the graph store

            //1. Delete ALL the direct children connections
            //const sourceTermArg: Rdf.Iri = sourceTerm.iri;
            const triplesToBeRemoved: Rdf.Triple[] = this.getUnselectedNodesTriplesToBeRemoved();
            const triplesToBeRemovedStr = triplesToBeRemoved.map(triple => `${triple.s}  ${triple.p}  ${triple.o}.`).reduce((tr, x: string) => x += "\n" + tr, "");
            AlignmentRDF.removeSourceChildTermFromAlignmentGraph(NGIri, triplesToBeRemovedStr).onValue(v => {//TBD: should we query further in order to track:false the removed subterms?
                console.log("Triple(s) deleted");

                //2. Add the new alignment matches to DB and track the newly aligned source-term
                if (!onlySourceTermChildren) {
                    currAlignment.addAlignment(sourceTerm.iri, sourceTerm.label, relation.iri, targetTerm.iri, targetTerm.label, inversed);
                    currAlignment.trackSourceTermAlignment(sourceTerm.iri, true);//----------Correct!
                }

                const hierRelTarget = this.hierRelTarget();
                const hierRelSource = this.hierRelSource();

                //Caching target flags
                if (!this.cachedTargetTermsFlagged.has(targetTerm.iri)) {
                    this.cachedTargetTermsFlagged.set(targetTerm.iri, new Set());//init
                }
                if (this.state.targetGraph && this.state.hierarchyRelations) this.recursivelyGetParents([this.targetGraphIri()], targetTerm.iri, targetTerm.iri, hierRelTarget, this.cachedTargetTermsFlagged);

                //Caching source flags
                if (!this.cachedSourceTermsFlagged.has(sourceTermOrigin.iri)) {
                    this.cachedSourceTermsFlagged.set(sourceTermOrigin.iri, new Set());//init
                }
                if (this.state.sourceGraph && this.state.hierarchyRelations) this.recursivelyGetParents([this.sourceGraphIri()], sourceTermOrigin.iri, sourceTermOrigin.iri, hierRelSource, this.cachedSourceTermsFlagged);


                //3. Store and visualize the new alignment.

                //3.a
                this.updateAlignmentState(currAlignment)

                //3.b. Add to the graph-store, track* and update the involved the tree-nodes (*Tracking the children hierarchy of the aligned source-term is used for the visualization of terms involved in alignment)
                let newGraph: Kefir.Property<Rdf.Graph> = AlignmentRDF.createAlignmentGraph(sourceTerm.iri, targetTerm.iri, relation, this.sourceGraphIri(), this.hierRelSource(), terminalNodes, partiallySelectedParentNodes, onlySourceTermChildren);
                newGraph.onValue(item => {
                    console.log("newGraph=====ok=====>"); //console.log(item.triples);
                    item.triples.forEach(triple => {//triple.s is a child added by the newGraph
                        if (onlySourceTermChildren && triple.p.value == this.props.broadMatchAlignmentRelation.iri.value) {
                            //Query to get the labels of the triple.s nodes
                            AlignmentRDF.selectTermLabel(triple.s as Rdf.Iri, this.sourceGraphIri()).onValue(label => {
                                let labelVal: Rdf.Literal = label.isEmpty() ? new Rdf.Literal("" + triple.s, undefined) : new Rdf.Literal(label.first().value, undefined);
                                currAlignment.addAlignment(triple.s as Rdf.Iri, labelVal, this.props.broadMatchAlignmentRelation.iri, targetTerm.iri, targetTerm.label, inversed);
                                this.updateAlignmentState(currAlignment);
                            })
                        }
                        //Track
                        currAlignment.trackSourceTermAlignment(triple.s as Rdf.Iri, true);//------------Correct!
                    });

                    //Retrieve all the children of the targetTerm (from graph-store) and update the targetTerm-node at the tree
                    const childrenQ: string = this.state.targetQueries.childrenQuery;
                    const childrenQ1 = childrenQ.replace(/\?parent/g, "" + targetTerm.iri);
                    const targetChildren = AlignmentRDF.uploadGraphAsync(NGIri, newGraph, childrenQ1);
                    const targetPath = this.targetForest.getOffsetPath(targetTerm);// NO: this.targetTree.state.forest.getOffsetPath(targetTerm);
                    this.targetTree.appendChildren(targetTerm, targetPath, targetChildren);//update tree-node
                    //TODO
                    //Update ANY OTHER tree-nodes already aligned to the same sourceTerm 
                    const forestnodes = this.targetForest.nodes;// NO: this.targetTree.state.forest.nodes; //all tree-nodes
                    if (currAlignment.getTargetTermsByAlignedSourceTermByRelation(sourceTerm.iri))
                        currAlignment.getTargetTermsByAlignedSourceTermByRelation(sourceTerm.iri)//this is supposed to fetch any target node from either exact or narrow match
                            .forEach(otherTargetTerm => {
                                if (otherTargetTerm.value == targetTerm.iri.value) return;
                                if (forestnodes.get(otherTargetTerm.value))
                                    forestnodes.get(otherTargetTerm.value)
                                        .forEach(treenode => {
                                            // console.log(treenode);
                                            // console.log(treenode.children);
                                            const path = this.targetForest.getOffsetPath(treenode);// NO: this.targetTree.state.forest.getOffsetPath(treenode);
                                            let childrenQ2 = childrenQ.replace(/\?parent/g, "" + treenode.iri);
                                            const children = AlignmentRDF.selectQuery(childrenQ2);

                                            triplesToBeRemoved.forEach(triple => this.targetTree.removeChildren(<Rdf.Iri>triple.s, path));
                                            //children.onValue(res => { console.log("ADD TARGET TERM " + otherTargetTerm.value + " NEW CHILDREN!!!!"); console.log(res);});
                                            this.targetTree.appendChildren2(treenode, path, children);
                                        })
                            });

                    //A delay is required until the cachedSourceTermsFlagged and cachedTargetTermsFlagged are updated
                    //otherwise not all nodes get flagged properly until the next state update
                    this.updateAlignmentState(currAlignment);//Kefir.later(2500, 1).onValue(val => this.updateAlignmentState(currAlignment));

                    //Unfortunatelly the next delete operation causes the problem of synchronizing the updateAlignmentState. The operation should be performed in a seperate context e.g. called from a button and wait until finishes
                    // AlignmentRDF.removeOrphanChildren(NGIri, this.sourceGraphIri(), this.targetGraphIri(), "" + this.props.broaderAlignmentRelation.iri).onValue(v => {
                    //     console.log("removeOrphanChildren is done");
                    //     this.updateAlignmentState(this.state.alignment);
                    // })
                    //     .onError(e => console.log("Delete error on removeOrphanChildren" + e));


                });//newGraph --end

            }).onError(e => console.log("Delete error" + e));

        })



    }

    /* Function returns the sub-term nodes of a term that have been excluded from selection  */
    getUnselectedNodesTriplesToBeRemoved = (): Rdf.Triple[] => {
        const selection: TreeSelection<Node> = this.state.selection;
        //console.log(selection.nodes);//map containing entries of type {nodeKey: Set of Children}
        //console.log(TreeSelection.leafs(selection));

        /*Notes:
        selection.nodes are maps of type <key:string, Set<Nodes with the same key>> and they include the selected nodes and their parent hierarchy.
        */
        let triplesToBeRemoved: Rdf.Triple[] = []; //Stores the triples to be removed in the alignment graph, regarding the source term sub-hierarchy
        const entries = selection.nodes.entries(); //<key:string, Set<Nodes with the same key>
        const selectedNode: SelectionNode<Node> = selection.getFirst(this.state.selectionMode.selectedRootKey); //1. get the selected-node (of the term to be aligned: considered as the root-term of the subhierarchy to be aligned)
        const rootNodePathOfSel = selection.getNodePath(selectedNode);                                          //2. get the parent path of the selected-node
        let parentNodeKeys: string[] = rootNodePathOfSel.slice(0, rootNodePathOfSel.length - 1).map(item => item.iri ? item.iri.value : undefined);//3. get all the parent nodes of the  selected-node, as well as (but not working) the root of the selection ...
        parentNodeKeys.push("tree:root");          //3. ...so add the (default) root of the selection by hand: due to a probable bug in TreeSelection mechanism: it doesn't return the 'tree:root' in all cases, maybe because it is not a real tree-node
        //console.log(rootNodePathOfSel);
        //console.log(selectedNode);
        //console.log(parentNodeKeys);

        //4. iterate all the nodes of the selection
        let nextEntry = entries.next();
        while (!nextEntry.done) {
            const key: string = nextEntry.value[0];

            //4a. Ignore those terms that are parent nodes of the selected-node
            if (parentNodeKeys.find(p => { /*console.log("compare p="); console.log(p);*/ return p == key })) {//Reject the parents of the selected-node
                //console.log("rejected key " + key);
                nextEntry = entries.next();
                continue;
            }
            //4b. For those terms that are children of the selected-node, do:

            //5. Check the children of the currNode (that is ACCEPTED for check) and compare the source-tree and the selection-forest children
            const currNode = TreeSelection.nodesFromKey(selection, key).first();                //currNode: the first tree-node of the given selected-key
            const sourceForestNodeChildren = this.sourceForest.nodes.get(key).first().children; //Get all the original children of the given selected-key in the sourceForest
            const selectionNodeChildren = currNode.children;                                    //Get all the selected children of the given selected-key in the selectionForest
            if (sourceForestNodeChildren && selectionNodeChildren) {                            //For all the original children that are not included in the selection, create a triple to be removed in the alignment graph
                sourceForestNodeChildren.forEach(child => {
                    const found = selectionNodeChildren.find(selChild => selChild.iri.value == child.iri.value)
                    //if (!found) console.log("unselected child:" + child.iri + " ////" + child.label);
                    if (!found) {
                        //TODO: the hierarchy relation is not the same as the matching relation
                        triplesToBeRemoved.push(new Rdf.Triple(child.iri, this.props.broaderAlignmentRelation.iri, new Rdf.Iri(key)));//+= "\n" + `${child.iri}   ${this.props.broaderAlignmentRelation.iri}  ${new Rdf.Iri(key)} . `
                    }
                })
            }
            nextEntry = entries.next();
        }
        return triplesToBeRemoved;
    }

    recursivelyRemoveNonAlignedChildrenOfTerm_atDB = (currAlignment, NGIri: Rdf.Iri, sourceTermArg: Rdf.Iri): Kefir.Property<any> => {
        //console.log("recursivelyRemoveNonAlignedChildrenOfTerm_atDB");

        //Get sourceTermArg's indirectly "aligned hierarchy" (recursively)
        AlignmentRDF.getTermDirectNonAlignedChildren(NGIri, sourceTermArg, this.targetGraphIri()).onValue(res => {
            console.log(res.length);
            res.forEach(r => {
                if (r.child) {
                    //Create the triple that should be deleted referred to the current child
                    let triple = `${r.child} ${this.props.broaderAlignmentRelation.iri} ${sourceTermArg}`;
                    triple = "\n" + triple + " .";
                    //Delete the triple
                    //AlignmentRDF.removeSourceChildTermFromAlignmentGraph(NGIri, triple, () => currAlignment.trackSourceTermAlignment(r.child, false));

                    AlignmentRDF.removeSourceChildTermFromAlignmentGraph(NGIri, triple).onValue(v => {
                        console.log("Triple deleted")
                        //Track update
                        currAlignment.trackSourceTermAlignment(r.child, false);//TODO: check
                        this.updateAlignmentState(currAlignment);
                        this.recursivelyRemoveNonAlignedChildrenOfTerm_atDB(currAlignment, NGIri, r.child);
                    }).onError(e => console.log("Delete error" + e));
                }
            });
        })
        return Kefir.constant("End of recursion");//It doesn't work in recursion. Although the recursion ends, the db updates cannot be synchronized
    };


    //Called when the 'non-aligned-terms' button is clicked
    private hiliteNonAlignedSourceTerms = (terms: Rdf.Iri[], hilite: boolean) => {
        //console.log("hiliteParentsOfTerms uses hierarchyRelation: " + hierarchyRelation);

        if (!hilite) {//Clear hilighting and return
            this.setStateFunc({
                alignment: this.state.alignment,
                selection: this.state.selection,
                hilitedNonAlignedAtSource: undefined,
            });
            return;
        }

        //...else retrieve the items to be hilited
        let hilitedParentsAtSource = new Map<Rdf.Iri, List<Rdf.Iri>>();
        terms.forEach(t => hilitedParentsAtSource.set(t, List<Rdf.Iri>()));//NEW, to include the current term even it has no parents

        AlignmentRDF.getParents([this.sourceGraphIri()], terms, this.hierRelSource())
            .onValue(res => {
                //@SOURCE NG

                res.forEach(tuple => {
                    const term = terms.find(t => t.value == tuple["child"].value);
                    if (term) {
                        let parentList: List<Rdf.Iri> = hilitedParentsAtSource.get(term) ? hilitedParentsAtSource.get(term) : List<Rdf.Iri>();
                        parentList = parentList.push(<Rdf.Iri>tuple["parent"]);
                        hilitedParentsAtSource.set(term, parentList);
                    }
                });


                //setState to force render...
                this.setStateFunc({
                    alignment: this.state.alignment,
                    selection: this.state.selection,
                    hilitedNonAlignedAtSource: hilitedParentsAtSource,
                    searchingForNonAlignedFlag: false,
                });

            }).onError((e: Error) => {
                console.log("Error");
                console.log(e.message);
            });
    }
    private createNonAlignedSourceTermsButton(): any {
        return this.spinner_onSearchingForNonAligned() ? Spinner({}) : createFactory(Button)({ //D.button
            //ref: (me) => this.nonAlignedSourceTermsButton = me,
            title: "Show non-aligned Terms",
            //bsSize: "small",
            bsStyle: 'link',
            className: `info_nonaligned_btn symbol`,
            onClick: (event) => {
                if (this.state.hilitedNonAlignedAtSource) {
                    this.setStateFunc({
                        alignment: this.state.alignment,
                        selection: this.state.selection,
                        hilitedNonAlignedAtSource: undefined,
                    });
                    return;
                }

                this.alignmentNG.onValue(NGIri => {
                    this.setStateFunc({
                        alignment: this.state.alignment,
                        selection: this.state.selection,
                        searchingForNonAlignedFlag: true,
                    });

                    AlignmentRDF.getNonAlignedSourceTerms(NGIri, this.sourceGraphIri(), this.targetGraphIri(), this.hierRelSource()).onValue(res => {
                        this.setStateFunc({
                            alignment: this.state.alignment,
                            selection: this.state.selection,
                            searchingForNonAlignedFlag: true,
                        });
                    });

                    AlignmentRDF.getNonAlignedSourceTerms(NGIri, this.sourceGraphIri(), this.targetGraphIri(), this.hierRelSource()).onValue(res => {
                        let terms: Array<Rdf.Iri> = [];
                        res.forEach(item => {
                            const x: Rdf.Iri = <Rdf.Iri>item["sourceTerm"];
                            terms.push(x);
                        });
                        this.hiliteNonAlignedSourceTerms(terms, true);
                    });
                })
            },
        },
        );

    }
    //NA GINEI ANTIKATASTASH GIA KALYTERO ELEGXO TWN UNDEFINED
    private sourceGraphIri = (): Rdf.Iri => this.state.sourceGraph ? this.state.sourceGraph.iri : undefined;
    private targetGraphIri = (): Rdf.Iri => this.state.targetGraph ? this.state.targetGraph.iri : undefined;
    private nextSourceGraphIri = (): Rdf.Iri => this.state.nextSourceGraph ? this.state.nextSourceGraph.iri : undefined;
    private nextTargetGraphIri = (): Rdf.Iri => this.state.nextTargetGraph ? this.state.nextTargetGraph.iri : undefined;
    private hierRelSource = (): string => this.state.hierarchyRelations ? this.state.hierarchyRelations.source : undefined;
    private hierRelTarget = (): string => this.state.hierarchyRelations ? this.state.hierarchyRelations.target : undefined;
    private hierRelSourceOptions = (): string[] => this.state.hierarchyRelationsOptions ? this.state.hierarchyRelationsOptions.source : undefined;
    private hierRelTargetOptions = (): string[] => this.state.hierarchyRelationsOptions ? this.state.hierarchyRelationsOptions.target : undefined;
    private hierRelAlignment = (): string => "" + this.props.broaderAlignmentRelation.iri;


    //Debugging
    debugState = (prevState: State, nextState: State) => {
        console.log("=======================debug PrevState=======================");
        console.log(prevState);
        console.log("=======================debug NextState=======================");
        console.log(nextState);
        console.log("==========================================================");
    }

}//class


function customizer(value) {
    if (_.isElement(value)) {
        return value.cloneNode(true);
    }
}

export function createSuperSourceAlignedTermsButton(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, term: Node, parentshipRelation: string, displayAt: React.ReactInstance, sourceMappings: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>>, addToSourceAlignedTermListFunc) { //| SourceTermMapping
    return createFactory(Button)({ //D.button
        title: "Info",
        //bsSize: "small",
        bsStyle: 'link',
        className: `info_btn symbol`,
        onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            //console.log(findDOMNode(displayAt).children[0].innerHTML);
            produceSuperSourceAlignedTerms(alignmentNG, sourceNG, term, parentshipRelation, displayAt, sourceMappings, addToSourceAlignedTermListFunc);
        },
    });
}
//TODO
export function produceSuperSourceAlignedTerms(alignmentNG: Rdf.Iri, sourceNG: Rdf.Iri, term: Node, parentshipRelation: string, displayAt: React.ReactInstance, sourceMappings: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>>, addToSourceAlignedTermListFunc) { //| SourceTermMapping
    const alignedTerms = AlignmentRDF.getAlignedTermsBySuperSourceTerm(alignmentNG, sourceNG, term.iri, parentshipRelation);
    let content = "";

    alignedTerms.onValue(res => {
        let key: { value: Rdf.Iri, done: boolean };// = keys.next();
        let lis = List();
        const termStyle = "";
        res.forEach((item, index) => {
            const key = sourceMappings.findKey((v, k) => k.value == item.sTerm.value);
            const mappingList: List<AlignedTermsMapping> = sourceMappings.get(key);
            const text = item.sLabel.value + "***" + item.rel.value.split("#").pop() + "***" + item.tLabel.value;
            //content += item.sLabel.value + "***" + item.rel.value.split("#").pop() + "***" + item.tLabel.value;
            //content += "\n";
            lis = addToSourceAlignedTermListFunc(lis, mappingList, key, index, termStyle, text);
        })
        //findDOMNode(displayAt).children[0].innerHTML = content;
        //console.log(lis);
        //findDOMNode(displayAt).innerHTML = React.PureComponent(D.ul({ className: "term-list", }, lis));
        //ReactDOM.unstable_renderSubtreeIntoContainer(findDOMNode(displayAt), D.ul({ className: "term-list", }, lis));
        //.textContent = note;
    });
}

export function createInfoButton(ngList: Rdf.Iri[], term: Node, displayAt: React.ReactInstance, hierRel: string, ngLabelList: Rdf.Iri[], ngScopenoteList: Rdf.Iri[]) { //| SourceTermMapping
    return createFactory(Button)({ //D.button
        title: "Info",
        //bsSize: "small",
        bsStyle: 'link',
        className: `info_btn symbol`,
        onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            produceInfo(ngList, term, displayAt, hierRel, ngLabelList, ngScopenoteList);
        },
    });
}

export function produceInfo(ngList: Rdf.Iri[], term: Node, target: React.ReactInstance, hierRel: string, ngLabelList: Rdf.Iri[], ngScopenoteList: Rdf.Iri[]) { //| SourceTermMapping
    const encodeLabel = (label: string) => ("" + label).replace(/>/g, "&right").replace(/</g, "&left").replace(/\"/g, "&quot;").replace(/'/g, "");
    const decodeLabel1 = (label: string) => ("" + label).replace(/&right/g, "&amp;gt;").replace(/&left/g, "\\&amp;lt;");
    const decodeLabel2 = (label: string) => ("" + label).replace(/&right/g, "&gt;").replace(/&left/g, "&lt;");
    const decodeQuotes = (str: string) => ("" + str).replace(/&quot;/g, "\\\"").replace(/&apos;/g, "\\'");
    const encodeQuotes = (str: string) => ("" + str).replace(/\\\"/g, "\"").replace(/\\'/g, "'");
    const decodeMarkup = (str: string) => ("" + str).replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    let noteHeader: string = `<h1><span class=\\"term-info-label\\">${encodeLabel(term.label.value)}</span></h1><br/>`;
    noteHeader += `<b>IRI:</b>&nbsp;<code>${term.iri.value}</code><br/>`;
    const scopeNote = AlignmentRDF.getAdditionalInfo(ngScopenoteList, term.iri);
    const parents = AlignmentRDF.getDirectParents(ngList, term.iri, hierRel, ngLabelList);
    scopeNote.onValue(res => {
        let noteBody: string = "<b>Scopenote:</b>";
        res.forEach((item, i) => {
            if (item.lang) { noteBody += `<br/><span class=\\"term-info-label\\">----@` + item.lang.value + "----</span>"; }
            //note += (i + 1) + ". " + item.scopeNote.value + "\n";
            noteBody += "<br/>" + encodeLabel(item.scopeNote.value);
        })
        parents.onValue(res2 => {
            let parentList = "";
            res2.forEach((item, i) => {
                if (item.parent) { parentList += `<li>${encodeLabel(item.parentLabel)}<code>${item.parent.value}</code></li>` }
            })
            parentList = parentList.length > 0 ? `<b>Parents:</b><br/><ul>${parentList}</ul>` : "";
            const getHTML = noteHeader + parentList + noteBody;
            const maximizeBtn = `<a href='#' 
            onClick='
            var newWindow = window.open(window.location + "info", "infowin", "menubar=no,toolbar=yes,location=no,resizable=yes,scrollbars=yes,status=yes,width=350,height=450", false); 
     
            sessionStorage.setItem("infowin", "yes");
            var head = newWindow.document.getElementsByTagName("head")[0]; 
            if (head==undefined) 
            {
                newWindow.document.write("<head></head>");
                head = newWindow.document.getElementsByTagName("head")[0]; //try again to get head
            }

            var styles = document.getElementsByTagName("style");
            var headHTML = "<link href=\\"http://localhost:3000/assets/no_auth/basic-styles.css\\" rel=\\"stylesheet\\" type=\\"text/css\\"/>"
            for (i = 0; i < styles.length; i++) { headHTML+="<style>"+styles[i].innerHTML+"</style>";}
            head.innerHTML= headHTML; 
            newWindow.document.write(head.innerHTML);
            
            var div = newWindow.document.createElement("div");
            div.innerHTML = "${decodeLabel1(decodeQuotes(getHTML))}" + "</br></br>";

            console.log("${decodeLabel1(decodeQuotes(getHTML))}");
            
            var body = newWindow.document.getElementsByTagName("body")[0];
            if (body==undefined)  {
                newWindow.document.write(div.innerHTML); //inits <body>
            } else { body.prepend(div); }

            newWindow.addEventListener("unload", function(e){sessionStorage.setItem("infowin", "no");} );
            '>(view)</a>`;
            findDOMNode(target).children[0].innerHTML = maximizeBtn + decodeLabel2(decodeMarkup(encodeQuotes(getHTML)));

            //Update the infowin if already open
            var infowin = sessionStorage.getItem("infowin");
            if (infowin && infowin == "yes") {
                const newWindow = window.open(window.location + "info", "infowin");
                const head = newWindow.document.getElementsByTagName("head")[0];

                //console.log(head);
                if (head != undefined) {//if !undefined it means the window exists
                    newWindow.document.write(""); //inits <body>
                    const body = newWindow.document.getElementsByTagName("body")[0];
                    //console.log(body);
                    if (body) {
                        const div = newWindow.document.createElement("div");
                        div.innerHTML = `${decodeLabel2(encodeQuotes(getHTML))}</br></br>`;
                        body.insertBefore(div, body.childNodes[0]);//equivalent to 'prepend(div)'
                    }
                } else {
                    newWindow.close();
                    sessionStorage.setItem("infowin", "no")
                }
            } else { sessionStorage.setItem("infowin", "no"); }
        })
    });
}


function produceMultipleParents(ng: Rdf.Iri, term: Node | AlignedTermsMapping, target: React.ReactInstance) {

    //TODO
}


function onFocusStartDragNodeFunc(e: HTMLSpanElement) {
    e.setAttribute("class", "dragging-enter-term");
}


function selectionToSparqlValues(forest: TreeSelection<Node>): string {
    //console.log("selectionToSparqlValues");   
    const sparqlValues: string = TreeSelection.leafs(forest).reduce((concat, node) => {
        return concat + " " + node.iri;
    }, "")
    //console.log(sparqlValues);
    return sparqlValues;
}

export type component = TermAlignmentEdit;
export const component = TermAlignmentEdit;
export const factory = createFactory(component);
export default component;




/*HOW TO*

const createKefirProperty: (any) => Kefir.Property<any> = (data: any) => Kefir.stream(emitter => emitter.emit(data)).toProperty();
const createListKefirProperty2: (any) => Kefir.Property<any> = (data: List<any>) => Kefir.stream(emitter => {
    data.map(x => emitter.emit(x))
}).toProperty();

*/