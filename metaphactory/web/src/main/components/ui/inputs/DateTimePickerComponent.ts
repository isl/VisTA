/*
 * Copyright (C) 2015-2017, metaphacts GmbH
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

import { DOM as D, Component, createFactory} from 'react';

import * as classNames from 'classnames';
// import * as Datetimepicker from 'react-bootstrap-datetimepicker';
// import 'react-bootstrap-datetimepicker/css/bootstrap-datetimepicker.css';
// const DateTimepicker = createFactory(Datetimepicker);
// import '../../scss/components/datetimepicker-component.scss';

// export interface DateTimePickerProps extends ReactBootstrapDatetimepickerModule.DatetimepickerProps {
//   className?:string;
// }

export class DateTimePickerClass extends Component<any, {}> {
  render() {
    return D.div(
      {
        className: (this.props.className ? classNames(this.props.className, 'datetimepicker-component') : 'datetimepicker-component'),
      }
      // TODO get rid off this component when we switch to forms for arguments
      // DateTimepicker(this.props)
    );
  }
}

export var DateTimePickerComponent = createFactory(DateTimePickerClass);
export default DateTimePickerComponent;
