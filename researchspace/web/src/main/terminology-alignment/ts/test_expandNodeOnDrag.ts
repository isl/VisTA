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

// import { DOM as D, Component, createFactory, MouseEvent, ReactElement, createElement, ReactNode } from 'react';
// import { Draggable } from '../../common/ts/components/dnd/DraggableComponent';
// import { Droppable } from '../../common/ts/components/dnd/DroppableComponent';

// interface Props { }
// interface State { }

// export class TermAlignmentTest extends Component<Props, State> {
//     private waitToExpand: any;
//     constructor(props: Props) {
//         super(props);
//     }



//     public render() {
//         return Draggable({ iri: term.iri.value },

//             Droppable({ //Display a default target term
//                 query: `ASK { ?value ?y ?z }`,
//                 onDrop: (draggedTerm: Rdf.Iri) => {
//                     //console.log("onDrop at Droppable" + text);
//                     //clearTimeout(this.waitToExpand);
//                     if (!this.state.selection) return;

//                     const sourceTerm: Term = this.getDraggedTerm();
//                     this.showRelationSelection(sourceTerm, term);
//                 },//onDrop
//             },

//                 D.span({
//                     title: term.iri.value,
//                     className: term.error ? styles.error : termStyle,

//                     onDragEnter: (e) => {
//                         //clearTimeout(this.waitToExpand);
//                         //console.log("onDragEnter " + text);
//                         if (term.hasMoreItems && !term.expanded)
//                             this.waitToExpand = setTimeout(this.expandNodeOnDrag, 2500, term);

//                     },
//                     onDragLeave: (e) => {
//                         clearTimeout(this.waitToExpand);
//                         //console.log("onDragLeave " + text);
//                     },

//                 },
//                     ...nodeParts) as React.ReactElement<any>,

//             ),
//         );
//     }