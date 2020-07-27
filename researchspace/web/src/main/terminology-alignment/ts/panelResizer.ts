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

import { DOM as D, Component, createFactory } from 'react';
import { findDOMNode } from 'react-dom';
import {
    Button, ButtonProps,
    // Overlay, InputGroup, FormControl, FormControlProps,
    // Tooltip, OverlayTrigger,
    // Nav, NavItem, Alert,
    // DropdownToggle,
    // MenuItem, ButtonGroup, DropdownButton
} from 'react-bootstrap';
import "../css/term-align.scss";


interface Props {
    refs: any;
    className_a: string;
    className_b: string;
    update?: { ref: any, a: any, b: any }[];//contains refs to other elements that must be updated

}

interface State {
    className_curr: string;//current
}

export class panelResizerComponent extends Component<Props, State> {

    constructor(props: Props) {
        super(props);
        this.state = { className_curr: props.className_a };
    }

    render() {
        return D.div({}, this.createExpandCollapseButton());
    }

    private createExpandCollapseButton() {

        const toggleClassProp = (classProp: { ref: string, a: string, b: string }) => {
            let targetRef: Element = findDOMNode<HTMLElement>(this.props.refs[classProp.ref]);
            if (!targetRef) return;
            let targetRefClass = targetRef.getAttribute("class");
            if (!targetRefClass) targetRefClass = "";
            if (targetRefClass.includes(classProp.a)) {
                targetRefClass = targetRefClass.replace(classProp.a, "");
                targetRefClass = targetRefClass.concat(" ", classProp.b);
            } else {
                targetRefClass = targetRefClass.replace(classProp.b, "");
                targetRefClass = targetRefClass.concat(" ", classProp.a);
            }
            targetRef.setAttribute("class", targetRefClass);
        }


        return createFactory(Button)({
            title: "Expand/Collapse PANEL",
            //bsSize: "small",
            bsStyle: 'link',
            className: this.state.className_curr + " symbol",
            onClick: (e: React.SyntheticEvent<ButtonProps>): void => {
                e.stopPropagation();
                const targetbtn = <HTMLElement>e.target;
                let nextClassState = (this.state.className_curr == this.props.className_a) ? this.props.className_b : this.props.className_a;
                targetbtn.setAttribute("class", nextClassState + " symbol");
                if (this.props.update) this.props.update.forEach(cprop => toggleClassProp(cprop)); //other elements
                this.setState({ className_curr: nextClassState });
            }
        });
    }




}