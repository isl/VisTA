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

import { DOM as D, Component, createFactory, MouseEvent, ReactElement, createElement, ReactNode } from 'react';
import { findDOMNode } from 'react-dom';
import * as Kefir from 'kefir';
import { Rdf } from 'platform/api/rdf';
import { DropdownButton, SplitButton, MenuItem, Button, ButtonGroup, Label } from 'react-bootstrap';
import ReactBootstrap = require('react-bootstrap');
import Spinner from 'platform/components/ui/spinner/Spinner';

import {
    // MutableNode,
    Node,
    // NodeTreeSelector,
    // NodeTreeProps,
    // EmptyForest,
    // queryMoreChildren,
    // RootsChange,
    // restoreForestFromLeafs,
} from 'platform/components/semantic/lazy-tree/NodeModel';

import { AlignmentRDF, SourceTermAlignmentType, TargetTermAlignmentType } from './AlignmentRDF';
import * as styles from 'platform/components/semantic/lazy-tree/SemanticTreeInput.scss';

import "../css/term-align.scss";



interface Props {
    inlineTerm?: boolean;
    sourceNG: Rdf.Iri;
    AlignmentNG: Kefir.Property<Rdf.Iri>;
    sourceTerm: Rdf.Iri;
    sourceLabel: string;
    targetTerm: Node;
    relation: Rdf.Iri;
    inversedRelation: boolean;
    nodeExpanded: boolean;
    removeTerm?: (sourceTerm: Rdf.Iri, targetTerm: Node, relation: Rdf.Iri, inversed: boolean, updateFunc: () => void) => void;
    hiliteSourceTermChildren?: (sourceTerm: Rdf.Iri, targetTerm: Node, relation: Rdf.Iri, hilite: boolean) => void;
    parentsButton?: React.ReactNode;
    infoButton?: React.ReactNode;
    hierarchyRelation?: () => string;
    termStyle?: string;//NEW
}

interface State {
    //renderScrollableDropdownContent?: Kefir.Property<ReactElement<any>>;
    renderDropdownContent?: ReactElement<any>[];
    loading: boolean;
    deleting?: boolean;

}


const DropdownButtonF = createFactory(DropdownButton);
const SplitButtonF = createFactory(SplitButton);
const MenuItemF = createFactory(MenuItem);
const ButtonGroupF = createFactory(ButtonGroup);
const ButtonF = createFactory(Button);
const LabelF = createFactory(Label);





export class AlignedElement extends Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = {
            renderDropdownContent: undefined,
            loading: false
        };
    }




    render() {
        if (this.props.inlineTerm) {
            return this.renderInlineTerm();//exact-match
        } else {
            return this.renderNodeTerm();//other-match
        }
    }


    renderNodeTerm() {
        let nodeParts: ReactNode[] = [this.props.sourceLabel];
        if (this.props.removeTerm) nodeParts.push(this.deleteButton());
        if (this.props.infoButton) nodeParts.push(this.props.infoButton);
        if (this.props.parentsButton) nodeParts.push(this.props.parentsButton);
        return D.span({//Note: Don't use D.div because the 'outline' css prop cannot be applied
            title: "" + this.props.sourceTerm.value,
            //className: this.props.termStyle,
            onMouseEnter: () => { this.props.hiliteSourceTermChildren ? this.props.hiliteSourceTermChildren(this.props.sourceTerm, this.props.targetTerm, this.props.relation, true) : undefined },
            onMouseLeave: () => { this.props.hiliteSourceTermChildren ? this.props.hiliteSourceTermChildren(this.props.sourceTerm, this.props.targetTerm, this.props.relation, false) : undefined },
        }, ...nodeParts);

    }

    renderInlineTerm() {

        //console.log("renderInlineTerm: " + this.state);

        const simpleLabel = ButtonF({
            id: "sL1",
            //bsSize: "small", //comment out for default size
            bsStyle: 'link',
            className: "inline-position-at-target " + this.props.termStyle,
            //title: this.props.sourceLabel,//label here
        }, this.props.sourceLabel);


        let nodeParts: ReactNode[] = (this.props.hierarchyRelation ? [this.dropdownButton()] : [D.span({ className: styles.holder }, simpleLabel)]);//init
        if (this.props.removeTerm) nodeParts.push(this.deleteButton());
        if (this.props.infoButton) nodeParts.push(this.props.infoButton);
        if (this.props.parentsButton) nodeParts.push(this.props.parentsButton);


        //Create the term-dropdown-button-group
        let buttonGroup = createElement(ButtonGroupF, {
            title: "" + this.props.sourceTerm.value,
            onMouseEnter: () => { this.props.hiliteSourceTermChildren ? this.props.hiliteSourceTermChildren(this.props.sourceTerm, this.props.targetTerm, this.props.relation, true) : undefined },
            onMouseLeave: () => { this.props.hiliteSourceTermChildren ? this.props.hiliteSourceTermChildren(this.props.sourceTerm, this.props.targetTerm, this.props.relation, false) : undefined },
        },
        );

        //return D.span({}, buttonGroup, ...nodeParts);
        return D.span({
            title: "" + this.props.sourceTerm.value,
            //className: this.props.termStyle,//is ignored
            onMouseEnter: () => { this.props.hiliteSourceTermChildren ? this.props.hiliteSourceTermChildren(this.props.sourceTerm, this.props.targetTerm, this.props.relation, true) : undefined },
            onMouseLeave: () => { this.props.hiliteSourceTermChildren ? this.props.hiliteSourceTermChildren(this.props.sourceTerm, this.props.targetTerm, this.props.relation, false) : undefined },
        }, ...nodeParts);

    }

    private spinner_onDeletingTerm = () => this.state.deleting;

    //Create delete-button as React-bootstrap button
    private deleteButton = () => {
        return (this.spinner_onDeletingTerm() ? D.span({ className: "spinner-delete-term" }, Spinner({})) : ButtonF({
            title: "Delete alignment",
            //bsSize: "small",
            bsStyle: 'link',
            className: "delete_btn inline-position-at-target delete-term-symbol",
            onClick: (event) => {
                //if (!(this.props.inlineTerm && this.props.nodeExpanded)) {//This is required to prevent unexpended expand/collapse node behavior of removed nodes
                event.preventDefault();
                event.stopPropagation();
                //}
                this.setState({ loading: this.state.loading, deleting: true }); //other solution: findDOMNode(event.currentTarget).setAttribute("class", "del-spinner");
                this.props.removeTerm(this.props.sourceTerm, this.props.targetTerm, this.props.relation, this.props.inversedRelation, () => this.setState({ loading: this.state.loading, deleting: false }));
            },
        })
        )
    }

    private dropdownButton() {

        let listOfChildren: ReactNode[] = undefined;//init

        //Decide whether to show the dropdown-children of the term
        if (this.state.loading) {
            listOfChildren = [D.div({ className: styles.holder, })];
        } else {
            //is not loading...
            if (this.state.renderDropdownContent) {
                if (this.state.renderDropdownContent.length > 0) {
                    listOfChildren = this.state.renderDropdownContent.map(res => {
                        return MenuItemF({
                            href: "#",
                            onClick: (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }
                        }, res);
                    });
                } else {//empty content
                    //listOfChildren = [MenuItemF({className: "autohide"}, "Currently, no subterms")];
                    //         listOfChildren = [MenuItemF({ className: "autohide" }, "Currently, no subterms")];
                }
            }
        }

        //Create the term-dropdown-button
        const dropdownButton = DropdownButtonF({
            //const dropdownButton = SplitButtonF({
            id: "ddb1",
            //bsSize: "small", //comment out for default size
            bsStyle: 'link',
            className: "inline-position-at-target " + this.props.termStyle,
            title: this.props.sourceLabel,//label here
            onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();

                //if currenly loading, return
                if (this.state.loading) {
                    this.setState({ renderDropdownContent: undefined, loading: true });
                    return;
                }

                //Otherwise...
                //Toggle children-display

                //if (!this.state.renderDropdownContent || this.state.renderDropdownContent.length == 0) {
                this.retrieveDropdownContent();//queries for 1st level children
                //}
            },

        }, ...listOfChildren);

        return dropdownButton;
    }

    private retrieveDropdownContent() { //: Kefir.Property<ReactElement<any>>
        this.props.AlignmentNG.onValue(NGIri =>
            AlignmentRDF.getSourceTermDirectChildrenAtGraph(this.props.sourceTerm, NGIri, this.props.sourceNG, this.props.hierarchyRelation)
                .onValue(res => {
                    this.setState({
                        renderDropdownContent:
                            res.reduce((components, item) => {
                                components.push(item["label"].value);
                                return components;
                            }, []),
                        loading: false
                    });
                })
                .onError((e: Error) => {
                    console.log("Error");
                    console.log(e.message);
                    this.setState({
                        renderDropdownContent: undefined,
                        loading: false
                    });
                })
        );
        this.setState({ renderDropdownContent: undefined, loading: true });
    }



}//class


export default AlignedElement;