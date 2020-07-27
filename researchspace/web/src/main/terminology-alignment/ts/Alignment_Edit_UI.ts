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

import { DOM as D, createFactory, ReactElement, createElement, ReactNode } from 'react';
import { findDOMNode } from 'react-dom';
import ReactBootstrap = require('react-bootstrap');
import {
    Button, ButtonProps,
    MenuItem, ButtonGroup, DropdownButton
} from 'react-bootstrap';
import { Rdf } from 'platform/api/rdf';
import Spinner from 'platform/components/ui/spinner/Spinner';
import { panelResizerComponent } from './panelResizer';
import "../css/term-align.scss";


export interface AlignedGraphProps {
    iri: Rdf.Iri;
    prefix?: string;
}

export interface GraphSelectorState {
    offset: number;
    graphList: ReactElement<any>[];
}

export module UI {
    /* Styling note: 
        The className 'row' applies a marginLeft=-15 to its contained divs
        Each panel is contained in a Div that has a "col-sm-?" className. Such cols contain a padLeft=15 
        */

    export function layout(refs, sourceGraph: AlignedGraphProps, targetGraph: AlignedGraphProps,
        createSourceGraphsDropdown, createTargetGraphsDropdown,
        createSourceSemanticTreeInput, createSourceSemanticTree, displaySourceAlignments,
        createTargetSemanticTreeInput, createTargetSemanticTree, displayTargetAlignments,
        createNonAlignedSourceTermsButton, createSourceHierarchySelector, createTargetHierarchySelector,
        alignButtonClickFunc, refreshButtonClickFunc, spinner_isLoadingAlignment,
        sourceSort: { state: 'asc' | 'desc', func: () => void }, targetSort: { state: 'asc' | 'desc', func: () => void }) {

        //Put here all the conditions that cause the "Spinner" to appear
        const spinner_onRefreshingDB = () => Boolean(refreshButtonClickFunc == undefined);

        //e.g. return this.spinner_onSearchingForNonAligned() ? Spinner({}) : createFactory(Button)({...})

        const Panel = createFactory(ReactBootstrap.Panel);
        const PanelGroup = createFactory(ReactBootstrap.PanelGroup);
        const Grid = createFactory(ReactBootstrap.Grid);
        const Button = createFactory(ReactBootstrap.Button);
        const infoTextA = `To align two terms: select a Source term and drag'n'drop on a Target term.`;
        const infoTextB = `Click on the info button next to each term to get more information about the term.`;

        const AlignButton = D.div({
            ref: "AlignButtonRef",
            key: "align",
            className: alignButtonClickFunc ? "fa fa-play-circle fa-2x alignEnabled" : "fa fa-stop-circle fa-2x alignDisabled",
            title: "Create new Alignment",
            //disabled: !(newAlignmentState),
            onClick: e => { alignButtonClickFunc ? alignButtonClickFunc() : undefined },
        });

        const RefreshButton = Button({
            bsStyle: 'link',
            ref: "RefreshButtonRef",
            key: "clean_but",
            //bsSize: "small",
            className: "fa fa-refresh fa-5x " + " symbol",
            title: "Refresh",
            onClick: e => { refreshButtonClickFunc() },
            // onClick: (e: React.SyntheticEvent<ButtonProps>): void => {
            //     console.log("refreshButton");

            // },
        });


        const sourceSearchDiv_initState = "col-sm-1";
        const sourceTermViewDiv_initState = "col-sm-3";
        const targetSearchDiv_initState = "col-sm-1";
        const targetTermViewDiv_initState = "col-sm-3";

        const panelHeaders = {

            //source headers

            sSearch: ["Search",
                createElement(panelResizerComponent, {
                    key: '1s',
                    refs: refs,
                    className_a: 'angle-right_btn float-right',
                    className_b: 'angle-left_btn float-right',
                    update: [
                        { ref: "sourceSearchDiv", a: `${sourceSearchDiv_initState}`, b: "col-sm-4" },//panel   a: "col-sm-1", b: "col-sm-3"
                    ]
                }
                ),
            ],

            sTermsView: ["Source Aligned Terms",
                createSortListButton("sourceListSort", sourceSort),
                createElement(panelResizerComponent, {
                    key: '2s',
                    refs: refs,
                    className_a: 'angle-right_btn float-right',
                    className_b: 'angle-left_btn float-right',
                    update: [
                        { ref: "sourceTermViewDiv", a: `${sourceTermViewDiv_initState}`, b: "col-sm-5" },//panel   a: "col-sm-1", b: "col-sm-3"
                        { ref: "displaySourceAlignment_ref", a: "div-list-hide", b: "div-list-show" },//div with list inside
                    ]
                }
                ),
            ],

            sTreeHier: ["Full Hierarchy of ", D.u({}, sourceGraph ? (sourceGraph.prefix ? sourceGraph.prefix : sourceGraph.iri.value) : ""), createSourceHierarchySelector,
                D.div({ key: '3shbtn', style: { float: "right" } }, createNonAlignedSourceTermsButton), spinner_onRefreshingDB() ? Spinner({}) : RefreshButton],



            //target headers

            tSearch: ["Search",
                createElement(panelResizerComponent, {
                    key: '1t',
                    refs: refs,
                    className_a: 'angle-right_btn float-right',
                    className_b: 'angle-left_btn float-right',
                    update: [
                        { ref: "targetSearchDiv", a: `${targetSearchDiv_initState}`, b: "col-sm-4" },//panel   a: "col-sm-1", b: "col-sm-3"
                    ]
                }
                ),
            ],

            tTermsView: ["Target Aligned Terms",
                createSortListButton("targetListSort", targetSort),
                createElement(panelResizerComponent, {
                    key: '2t',
                    refs: refs,
                    className_a: 'angle-right_btn float-right',
                    className_b: 'angle-left_btn float-right',
                    update: [
                        { ref: "targetTermViewDiv", a: `${targetTermViewDiv_initState}`, b: "col-sm-5" },//panel   a: "col-sm-1", b: "col-sm-3"
                        { ref: "displayTargetAlignment_ref", a: "div-list-hide", b: "div-list-show" },//div with list inside
                    ]
                }
                ),
            ],

            tTreeHier: ["Full Hierarchy of ", D.u({ key: "d3t" }, targetGraph ? (targetGraph.prefix ? targetGraph.prefix : targetGraph.iri.value) : ""), createTargetHierarchySelector]

        }


        return D.div({ className: "row", },

            D.div({ className: "row", },

                //SOURCE ZONE
                D.div(
                    { ref: "sourceZone", className: "col-sm-6 ", /*style: { borderStyle: "solid", borderColor: "red" }*/ },//padRight0

                    //SOURCE TOP ZONE
                    D.div({
                        className: "row top20 padLeft20"
                    }, D.b({ className: "col-sm-2" }, "Source Terminology "), D.div({ className: "col-sm-9" }, createSourceGraphsDropdown), D.div({ className: "col-sm-1" }, (spinner_isLoadingAlignment() ? Spinner({}) : AlignButton))),
                    D.div({
                        className: "row top20"
                    }, /*D.div(
                    { className: "col-sm-12" },
                    createSourceGraphsDropdown
                )*/
                    ),

                    //SOURCE PANELS ZONE
                    D.div({
                        key: sourceGraph ? sourceGraph.iri.value : "sourceTree",
                        className: "row top20",
                        style: { display: sourceGraph && targetGraph ? 'block' : 'none', /*borderStyle: "solid", borderColor: "green"*/ },
                    },
                        D.div({//1.Search
                            ref: "sourceSearchDiv",
                            key: '1sd',
                            //title: "Source Search Div",
                            className: `${sourceSearchDiv_initState} collapse-expand-panel-width`,
                        },
                            Panel({
                                ref: "searchPanel",
                                key: '1s',
                                className: "alignment-panel",
                                collapsible: false,
                                header: panelHeaders.sSearch,
                            }, createSourceSemanticTreeInput)
                        ),
                        D.div({//2.View (aligned term list)
                            ref: "sourceTermViewDiv",
                            key: '2sd',
                            className: `${sourceTermViewDiv_initState} collapse-expand-panel-width mergePanels`,
                        },
                            Panel({
                                //ref: 'sourceTermViewDiv_2s',
                                key: '2s',
                                className: "alignment-panel",
                                collapsible: false,
                                header: panelHeaders.sTermsView,
                            }, displaySourceAlignments),
                        ),
                        D.div({//3.Tree
                            key: '3sd',
                            className: "width-auto collapse-expand-panel-width mergePanels ",//'padRight0' doesn't work because it is overriden by the lazytree 
                            style: { paddingRight: '7px' }
                        },
                            Panel({
                                key: '3s',
                                className: "alignment-panel",
                                collapsible: false,
                                header: panelHeaders.sTreeHier,
                                footer: sourcePanelFooter(infoTextA),
                            }, createSourceSemanticTree)
                        )
                    ),//div
                ),

                //TARGET ZONE
                D.div(
                    { ref: "targetZone", className: "col-sm-6", /*style: { borderStyle: "solid", borderColor: "red" }*/ },

                    //TARGET TOP ZONE
                    D.div({
                        className: "row top20 padLeft20"
                        // }, D.b({}, "Target Terminology "), createTargetGraphsDropdown),//createTargetHierarchySelector
                    }, D.b({ className: "col-sm-2" }, "Target Terminology "), D.div({ className: "col-sm-9" }, createTargetGraphsDropdown)),
                    D.div({
                        className: "row top20"
                    },/* D.div(
                    { className: "col-sm-12" },
                    createTargetGraphsDropdown
                    )*/
                    ),


                    //TARGET PANELS ZONE
                    D.div({
                        key: targetGraph ? targetGraph.iri.value : "targetTree",
                        className: "row top20",
                        style: { display: sourceGraph && targetGraph ? 'block' : 'none', /*borderStyle: "solid", borderColor: "green"*/ },
                    },
                        /* Styling Note: The Tree SHOULD NOT be created first because 
                        the 'width-auto' property dominates the space and then 
                        the sibling divs are created in the next line. We created it last and bring it first using 'float-left' 
                        */
                        // D.div({//1.Tree
                        //     ref: 'targetHierarchyDiv',
                        //     key: '3td',
                        //     className: "col-sm-5", //"width-auto collapse-expand-panel-width"
                        //     style: { paddingLeft: '7px' }
                        // },
                        //     Panel({
                        //         key: '3t',
                        //         className: "alignment-panel",
                        //         collapsible: false,
                        //         header: "Full Hierarchy",
                        //         footer: targetPanelFooter
                        //     }, createTargetSemanticTree)
                        // ),


                        /* Styling Note: The Search and View divs are created in reversed order due to the 'float-right' property */
                        D.div({//3.Search
                            ref: "targetSearchDiv",
                            key: '1td',
                            className: `${targetSearchDiv_initState} mergePanels collapse-expand-panel-width float-right`,
                        },
                            Panel({
                                key: '1t',
                                ref: "searchPanel",
                                className: "alignment-panel",//alignment-div-hide
                                collapsible: false,
                                header: panelHeaders.tSearch,
                            }, createTargetSemanticTreeInput)
                        ),

                        D.div({//2.View (aligned term list)
                            ref: "targetTermViewDiv",
                            key: '2td',
                            className: `${targetTermViewDiv_initState} mergePanels collapse-expand-panel-width float-right`,
                            //style: { paddingLeft: '0px' },
                        },
                            Panel({
                                key: 'targetTermViewDiv_2t',
                                className: "alignment-panel",
                                collapsible: false,
                                header: panelHeaders.tTermsView,
                            }, displayTargetAlignments),
                        ),

                        D.div({//1.Tree
                            key: '3td',
                            className: "width-auto collapse-expand-panel-width ", //col-sm-5",
                            style: { paddingLeft: '7px', paddingRight: '15px' }
                        },
                            Panel({
                                key: '3t',
                                className: "alignment-panel",
                                collapsible: false,
                                header: panelHeaders.tTreeHier,
                                footer: targetPanelFooter(infoTextB),
                            }, createTargetSemanticTree)
                        ),
                    )
                )
            ),
            sourceGraph && targetGraph ?
                D.div({},
                    D.text({ style: { fontWeight: "bold", fontStyle: "oblique" } }, "NOTATION"),

                    D.br(),
                    D.text({ className: "aligned-term", style: { margin: "5px" } }, "aligned-term"),
                    D.text({ className: "aligned-term-implicitly", style: { margin: "5px" } }, "implicitly aligned-term"),

                    D.br(),
                    D.text({ className: "aligned-term-broader", style: { margin: "5px" } }, "broader aligned-term"),
                    D.text({ className: "aligned-term-broader-implicitly", style: { margin: "5px" } }, "implicitly broader aligned-term"),

                    D.text({ className: "aligned-term-exact", style: { margin: "5px" } }, "exact match"),
                    D.text({ className: "aligned-term-close", style: { margin: "5px" } }, "close match"),
                    D.text({ className: "aligned-term-related", style: { margin: "5px" } }, "related match"),

                    D.text({ className: "delete_btn inline-position-at-target delete-term-symbol", style: { margin: "5px" } }, "deletable aligned-term"),

                    D.br(),
                    D.text({ className: "hilite-parent-terminal-term", style: { margin: "5px" } }, "focus on a term"),
                    D.text({ className: "hilite-parent-term", style: { margin: "5px" } }, "parent of the focused a term"),

                    D.text({ className: "hilite-parent-terminal-term2", style: { margin: "5px" } }, "non-aligned term"),
                    D.text({ className: "hilite-parent-term2", style: { margin: "5px" } }, "parent of non-aligned term"),

                    D.br(),
                    D.text({ className: "search-focus-terminal-term", style: { margin: "5px" } }, "search-focus on a term"),
                    D.text({ className: "search-focus-term", style: { margin: "5px" } }, "search-focus on a parent term"),

                    D.text({ className: "view-focus-terminal-term", style: { margin: "5px" } }, "focus on an aligned term"),
                    D.text({ className: "view-focus-term", style: { margin: "5px" } }, "focus on a parent of an aligned term"),

                    D.br(),
                    D.text({ className: "view-focus-source-terminal-term aligned-term-exact", style: { margin: "5px" } }, "focus on a exact match term at target"),
                    D.text({ className: "view-focus-source-terminal-term aligned-term-close", style: { margin: "5px" } }, "focus on a close match term at target"),
                    D.text({ className: "view-focus-source-terminal-term aligned-term-related", style: { margin: "5px" } }, "focus on a related match term at target")


                ) : undefined
        );
    }



    const createExpandCollapseButton = (key, initState_btn_class, collapse_btn_class, expand_btn_class, toggleProps?: { ref: React.ReactInstance | HTMLElement, a: string, b: string }[]) => createFactory(Button)({
        key: key + "_but",
        title: "Expand/Collapse",
        //bsSize: "small",
        bsStyle: 'link',
        className: initState_btn_class + " symbol",
        onClick: (e: React.SyntheticEvent<ButtonProps>): void => {
            e.stopPropagation();
            const targetbtn = <HTMLElement>e.target;
            toggleClassProp({ ref: targetbtn, a: collapse_btn_class, b: expand_btn_class });//expand/collapse button
            if (toggleProps) toggleProps.forEach(prop => toggleClassProp(prop)); //other elements
        }
    });

    const toggleClassProp = (prop: { ref: React.ReactInstance | HTMLElement, a: string, b: string }) => {
        let targetRef: Element;
        if (prop.ref instanceof HTMLElement) targetRef = prop.ref
        else if (findDOMNode(prop.ref)) targetRef = findDOMNode(prop.ref)
        else return;

        if (!targetRef) return;
        let targetRefClass = targetRef.getAttribute("class");

        if (!targetRefClass) targetRefClass = "";
        if (targetRefClass.includes(prop.a)) {
            targetRefClass = targetRefClass.replace(prop.a, "");
            targetRefClass = targetRefClass.concat(" ", prop.b);
        } else {
            targetRefClass = targetRefClass.replace(prop.b, "");
            targetRefClass = targetRefClass.concat(" ", prop.a);
        }
        targetRef.setAttribute("class", targetRefClass);
    }

    const createSortListButton = (key, sort: { state: 'asc' | 'desc', func: () => void }) => createFactory(ReactBootstrap.Button)({ //D.div({ //createFactory(Button)({
        bsStyle: 'link',
        ref: key,// + "_Ref",
        key: key,
        className: sort.state == 'asc' ? "fa fa-arrow-down fa-2x" : "fa fa-arrow-up fa-2x",
        title: sort.state == 'asc' ? "Ascending order" : "Descending order",
        //disabled: !(newAlignmentState),
        onClick: e => { sort.func ? sort.func() : undefined },
    });


    function sourcePanelFooter(infoText) {
        return D.span({ id: "sourceTermInfo", className: "noteBox", ref: "sourceTermInfo" }, D.i({}, infoText));
    }

    function targetPanelFooter(infoText) {
        return D.span({ id: "targetTermInfo", className: "noteBox", ref: "targetTermInfo" }, D.i({}, infoText));
    }

    export function createGraphsDropdown(graph: AlignedGraphProps, graphSelectorState: GraphSelectorState, retrieveGraphs: (any) => void, nextAlignmentState?: (any) => void) {
        const ButtonGroupF = createFactory(ButtonGroup);
        const DropdownButtonF = createFactory(DropdownButton);
        const MenuItemF = createFactory(MenuItem);

        let dropdownButton = undefined;
        let listGraphs: ReactNode[] = undefined;//init
        if (graphSelectorState && graphSelectorState.graphList) {
            listGraphs = graphSelectorState.graphList.map(res => {
                return res;
            });
        } else {
            listGraphs = [MenuItemF({}, "Graphs not Loaded")];
        }
        dropdownButton = DropdownButtonF({
            id: "graphsDropdown",
            title: graph && graph.iri ? graph.iri.toString() : "Choose Graph",//label here
            className: "btn-block",
            onClick: (event) => {
                if (!graphSelectorState || !graphSelectorState.graphList) {
                    retrieveGraphs(0);
                }
            },
            onSelect: key => {
                //this.waitToChooseSource = !this.waitToChooseSource;
                //this.initVars();
                if (graph && graph.iri && graph.iri.value == key) return;
                nextAlignmentState(key);
            },

        }, listGraphs);

        const graphDropdown = ButtonGroupF({ block: true, vertical: true },
            dropdownButton
        );

        return graphDropdown;
    }


    export function createHierarchySelector(id: "source" | "target", hierarchyRelations: string[], setStateFunc, title?: string) {
        if (!hierarchyRelations) return undefined;
        const DropdownButtonF = createFactory(DropdownButton);
        const MenuItemF = createFactory(MenuItem);
        let optionList: ReactNode[] = hierarchyRelations.map(item => {
            return MenuItemF({ key: item, eventKey: item }, item);
            //return D.span({id:item}, item);
        });
        const dropdownButton = DropdownButtonF({
            id: id + "_hierarchy",
            title: title ? title : "Choose hierarchy relation", //label here
            className: "btn-block",
            bsSize: "xsmall",
            onSelect: key => { setStateFunc(key); },
        }, optionList);
        return dropdownButton;
    }

    // export function refreshAlignmentGraph() {
    //     const refreshButton = createFactory(Button)({
    //         key: "clean_but",
    //         title: "Refresh",
    //         //bsSize: "small",
    //         bsStyle: 'link',
    //         className: " symbol",
    //         onClick: (e: React.SyntheticEvent<ButtonProps>): void => {
    //             console.log("refreshButton");

    //         }
    //     });
    //     return refreshButton;
    // }

}