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

import { DOM as D, Component, createElement } from 'react';
import { List } from 'immutable';
import * as _ from 'lodash';
import { Rdf } from 'platform/api/rdf';
import {
    Node,
} from 'platform/components/semantic/lazy-tree/NodeModel';
import { AlignedTermsMapping } from './Alignment';
import { AlignedGraphProps } from './Alignment_Edit_UI';

type Term = Node;

interface Props {
    mappings: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>>;
    graph: AlignedGraphProps;
    selectedAlignment: Map<string, string>;
    iriprop: string;
    labelprop: string;
    termStyle: (term: Term, termStyle: string, parentStyle: string, hilitedParents: Map<Rdf.Iri, List<Rdf.Iri>>) => string;
    hilitedParents: Map<Rdf.Iri, List<Rdf.Iri>>,
    sortList: 'asc' | 'desc';
    onClickTerm: (clickedIri: Rdf.Iri, mappingList: List<AlignedTermsMapping>) => void;
    checkTermSynchronized?: (term: Rdf.Iri, syncTermFunc: ({ sync: boolean, reason: string }) => void) => void;
}

interface State { }

export class DisplayAlignedTermsComponent extends Component<Props, State> {
    labelprop = `${this.props.labelprop}`;
    iriprop = `${this.props.iriprop}`;

    constructor(props: Props) {
        super(props);
    }


    render() {
        //console.log("-------------------render D");
        return D.div({ className: "padRight0" }, this.displayAlignments());
    }


    item2Node = (item: Term | AlignedTermsMapping): Term => {
        let retVal = item;
        if (item && item["iri"]) return <Term>item;
        else if (item && !item["iri"]) return { iri: item[this.iriprop], label: item[this.labelprop] };
        // if (item && item === <Term>item) retVal = <Term>item;
        // else if (item && item === <AlignedTermsMapping>item) retVal = { iri: item["iri"], label: item[this.labelprop] };
        //console.log(retVal);
        return <Term>retVal;
    }


    private displayAlignments(): React.ReactElement<any> {//View

        const mappings: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>> = this.props.mappings;
        if (!mappings) return;

        const labelprop = this.labelprop;
        let mappingsOrdered: Immutable.Map<Rdf.Iri, List<AlignedTermsMapping>>
        let orderedLabels: Immutable.OrderedMap<Rdf.Iri, string>; // orderedLabels.forEach((v, k) => console.log("^" + v.value + "^"))
        if (this.props.sortList) {
            const sort: 'asc' | 'desc' = this.props.sortList;
            if (sort == 'asc') orderedLabels = mappings.map(value => value.get(0)[labelprop].toString().toLowerCase()).sort().toOrderedMap();
            if (sort == 'desc') orderedLabels = mappings.map(value => value.get(0)[labelprop].toString().toLowerCase()).sort().reverse().toOrderedMap();
        }
        //console.log(orderedLabels);
        //console.log(mappings);

        const keys = (orderedLabels ? orderedLabels.keys() : mappings.keys());//terms-iris, are the keys
        let key: { value: Rdf.Iri, done: boolean } = keys.next();

        let lis = List();
        let index = 0;
        while (!key.done) {//go to next target
            const termStyle = this.props.termStyle(this.item2Node(mappings.get(key.value).get(0)), "hilite-parent-terminal-term", "hilite-parent-term", this.props.hilitedParents);
            const mappingList: List<AlignedTermsMapping> = mappings.get(key.value); //To key.value: Rdf.Iri prepei na diasfalistei oti einai to idio
            let label: any = mappingList.get(0)[labelprop];
            if (!label) {
                label = key.value.value;
            } else {
                label = (this.props.graph.prefix ? this.props.graph.prefix : "") + label.value;
            }
            lis = this.addToAlignedTermList(lis, mappingList, key, index++, termStyle, label);
            key = keys.next();
        }//while

        return D.div({
            //ref: "displaySourceAlignment_ref",
            className: "div-list-show",
        }, D.ul({ className: "term-list", }, lis))

    }

    private addToAlignedTermList(lis: List<{}>, mappingList: List<AlignedTermsMapping>, key: { value: Rdf.Iri, done: boolean }, index: number, termStyle: string, text: string) {
        const li = D.li(
            {
                title: key.value.value,
                key: index,
                className: (this.props.selectedAlignment ? this.props.selectedAlignment.get(key.value.value) : "") + termStyle,
                data: key.value.value,
                style: { cursor: "pointer" },
                onClick: (event) => {
                    const clickedIri: Rdf.Iri = new Rdf.Iri(event.currentTarget.getAttribute("data"));
                    this.props.onClickTerm(clickedIri, mappingList);
                }//onClick
            }, text
        );
        return lis.push(createElement(syncTermComponent, { basicTermComponent: li, checkTermSynchronized: this.props.checkTermSynchronized.bind(this, key.value) }));
    }


}

export default DisplayAlignedTermsComponent;



/////////////SYNCHRONIZED TERM INDICATOR/////////////////

class syncTermComponent extends Component<{ basicTermComponent: any, checkTermSynchronized: any }, { sync: boolean, reason?: string, tooltip: boolean, style: any }> {

    constructor(props: { basicTermComponent: any, checkTermSynchronized: any }) {
        super(props);
        this.state = { sync: false, reason: undefined, tooltip: false, style: undefined };
    }

    componentDidMount() {
        //all the other arguments of this function have been "binded" in previous calls
        this.props.checkTermSynchronized((syncState: { sync: boolean, reason?: string }) => this.setState(syncState));
    }
    //Even when a props.function is the same, the state might change if we run it. So we try to detect the new state by calling the function.
    componentWillReceiveProps(props) {
        this.componentDidMount();
    }

    render() {
        const setStyle = { backgroundColor: "lightblue" }; // top: e.clientY, left: e.clientX, 
        return (this.state.sync ?
            D.div({
                style: { display: 'flex', flexWrap: 'wrap' }
            },
                this.props.basicTermComponent,
                D.div({ //createFactory(Button)({
                    key: "wrench",
                    className: 'margin-left-5 fa fa-wrench',
                    onMouseEnter: (e: React.SyntheticEvent<HTMLDivElement>) => {
                        e.stopPropagation(); e.preventDefault(); this.setState(_.assign(this.state, { tooltip: true }, { style: setStyle }))
                    },
                    onMouseLeave: () => this.setState(_.assign(this.state, { tooltip: false })),
                }),
                (this.state.tooltip && this.state.reason ? D.span({ key: "tooltip", style: this.state.style }, this.state.reason) : undefined)
            )
            : this.props.basicTermComponent
        )
    }

}

