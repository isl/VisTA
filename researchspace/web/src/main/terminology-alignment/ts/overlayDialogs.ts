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

import { DOM as D, Component, createFactory, ReactNode, ReactElement, createElement } from 'react';
import { OverlayDialog } from 'platform/components/ui/overlay/OverlayDialog';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import {
   DropdownButton,
   SplitButton,
   MenuItem,
   Button,
   Modal,
   ButtonGroup,
   ButtonToolbar,
   FormGroup,
   ControlLabel,
   FormControl,
   Alert
} from 'react-bootstrap';


export module OverlayDialogs {

   export function showDialog(dialogKey: string, dialogElement: React.ReactElement<any>) {
      getOverlaySystem().show(dialogKey, dialogElement);
   }

   export function hideDialog(dialogKey: string) {
      getOverlaySystem().hide(dialogKey);
   }

   export function create_yes_no_OverlayDialog(dialogName: string, dialogTitle: string, alertMsg: ReactNode, funcOnYes: () => void, funcOnNo?: () => void, funcOnHide?: () => void): ReactElement<any> {
      const dialog = OverlayDialog({
         bsSize: 'lg',
         show: true,
         type: 'modal',
         title: dialogTitle,
         onHide: () => {
            getOverlaySystem().hide(dialogName);
            if (funcOnHide) funcOnHide();
         },
         children: [
            createFactory(Alert)(
               { key: 1, bsStyle: 'warning' },
               alertMsg
            ),
            createFactory(ButtonToolbar)(
               { key: 2 },

               //1. button YES
               createFactory(Button)(
                  {
                     block: true,
                     onClick: () => {
                        getOverlaySystem().hide(dialogName);
                        funcOnYes();
                     }
                  },
                  'Yes'
               ),

               //2. button NO
               createFactory(Button)(
                  {
                     active: true,
                     block: true,
                     bsStyle: 'primary',
                     onClick: () => {
                        getOverlaySystem().hide(dialogName);
                        if (funcOnNo) funcOnNo();
                     }
                  },
                  'No'
               )
            )//ButtonToolbar
         ]
      });

      return dialog;
   }

   export function create_action_OverlayDialog(dialogName: string, dialogTitle: string, action: ReactNode, funcOnHide?: () => void): ReactElement<any> {
      const dialog = OverlayDialog({
         bsSize: 'lg',
         show: true,
         type: 'modal',
         title: dialogTitle,
         onHide: () => {
            getOverlaySystem().hide(dialogName);
            if (funcOnHide) funcOnHide();
         },
         children: [action]
      });

      return dialog;
   }

}